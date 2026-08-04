from openai import OpenAI
import os, socket, time, json, pathlib

# load an instruction file in JSON-lines format
def loader(file):
    abs_path = os.path.abspath(__file__)
    current_dir = os.path.dirname(abs_path)
    path = pathlib.Path(os.path.join(current_dir, file))
    text = path.read_text()
    lines = text.split("\n")
    res = []
    for line in lines:
        try:
            line = line.strip()
            if not line.startswith("{"):
                continue
            res.append(json.loads(line))
        except:
            print("error parsing line:", line)
    print(f"loaded #{len(res)} instructions from {file}")
    return res


class LLM:
    def __init__(self, args):
        # params
        self.base_url = args.get("AI_BASE_URL", os.getenv("AI_BASE_URL", "missing AI_BASE_URL"))
        self.api_key = args.get("AI_API_KEY", os.getenv("AI_API_KEY", "missing AI_API_KEY"))
        self.model = args.get("AI_CHAT_MODEL", os.getenv("AI_CHAT_MODEL", "missing AI_CHAT_MODEL"))
        self.rate = 0.01

        self.instruct = loader("doc.jsonl")
        print(self.model)
        print(self.instruct)

        self.messages = list(self.instruct)
        self.context = []
        if "messages" in args:
            self.context = args.get("messages", []) or []
            self.messages += self.context

        # Resilience: deploy-time AI_BASE_URL / AI_CHAT_MODEL may be slightly
        # off for the provider (e.g. missing "/v1", or a model id the provider
        # no longer serves), which would make every generative command stream
        # nothing. Self-heal both so the AI email manager keeps working
        # without touching immutable .env config.
        self.base_url, self.model, self.ai = self._bootstrap_client(self.base_url, self.api_key, self.model)

    def _bootstrap_client(self, base_url, api_key, model):
        candidates = [base_url]
        norm = (base_url or "").rstrip("/")
        if not norm.endswith("/v1"):
            candidates.append(norm + "/v1")
        last_err = None
        for url in candidates:
            try:
                client = OpenAI(base_url=url, api_key=api_key)
                available = [m.id for m in client.models.list().data]
            except Exception as exc:
                last_err = exc
                print(f"base_url '{url}' not usable:", exc)
                continue
            resolved = model if model in available else self._pick_fallback(available, model)
            if resolved != model:
                print(f"configured model '{model}' not found; using '{resolved}'")
            print(f"using base_url '{url}' model '{resolved}' available={len(available)}")
            return url, resolved, client
        print("no usable base_url found, keeping configured:", base_url, last_err)
        return base_url, model, OpenAI(base_url=base_url, api_key=api_key)

    def _pick_fallback(self, available, configured):
        for preferred in ("glm-5.2", "glm-5.1", "gpt-oss:120b", "gpt-oss:20b",
                         "deepseek-v4-pro", "kimi-k3", "mistral-large-3:675b",
                         "deepseek-v4-flash", "gemma4:31b"):
            if preferred in available:
                return preferred
        return available[0] if available else configured

    # ---- message helpers ----
    def message(self, role, content):
        self.messages.append({"role": role, "content": content})

    # ---- streaming core ----
    def stream(self, args, lines):
        out = ""
        sock = None
        host = args.get("STREAM_HOST", "")
        port = int(args.get("STREAM_PORT") or "0")
        if host and port:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((host, port))
        try:
            for line in lines:
                if sock is not None:
                    sock.sendall(json.dumps(line).encode("utf-8"))
                    time.sleep(self.rate)
                out += line
        except Exception as e:
            print(e)
            print("interrupted")
        if sock is not None:
            sock.close()
        return out

    def _complete(self, messages):
        """Stream a completion for an explicit message list (does not mutate self.messages)."""
        stream = self.ai.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True,
        )
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    def _ask(self, inp):
        self.messages.append({"role": "user", "content": inp})
        print(f"context: {len(self.context)} instruct: {len(self.instruct)} messages: {len(self.messages)}")
        return self._complete(self.messages)

    def ask(self, args, inp):
        return self.stream(args, self._ask(inp))

    # ---- text helpers ----
    def _text(self, lines):
        for line in lines.splitlines():
            for word in line.split(" "):
                yield word + " "
            yield "\n"

    def text(self, args, lines):
        return self.stream(args, self._text(lines))

    def _rag(self, args):
        for msg in self.instruct:
            yield f"- *{msg['role'].capitalize()}*: {msg['content']}\n"

    def rag(self, args):
        return self.stream(args, self._rag(args))

    # ---- email-aware generative helpers ----
    def _email_block(self, email):
        sender = email.get("from", {})
        return (
            f"Subject: {email.get('subject','')}\n"
            f"From: {sender.get('name','')} <{sender.get('email','')}>\n"
            f"Date: {email.get('date','')}\n"
            f"Body:\n{email.get('body','')}\n"
        )

    def _thread_block(self, emails):
        parts = []
        for e in emails:
            parts.append(self._email_block(e))
        return "\n---\n".join(parts)

    def complete_with(self, args, system_prompt, user_prompt):
        """Stream a generative answer built from a system + user prompt."""
        messages = [{"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}]
        # also keep short conversational context for continuity
        recent = [m for m in self.context if m.get("role") in ("user", "assistant")][-4:]
        messages += recent
        messages.append({"role": "user", "content": user_prompt})
        return self.stream(args, self._complete(messages))

    def summarize(self, args, emails):
        summary_instruct = next(
            (m["content"] for m in self.instruct if m.get("role") == "system" and "email manager" in m.get("content", "").lower()),
            "You are an AI email assistant. Summarize concisely.",
        )
        prompt = "Summarize the following emails in a concise bulleted digest. " \
                 "Highlight senders, key points, anything urgent, and any deadlines.\n\n"
        prompt += self._thread_block(emails)
        return self.complete_with(args, summary_instruct, prompt)

    def summarize_email(self, args, email):
        prompt = "Summarize this email in 3-5 bullet points and call out any action items or deadlines.\n\n"
        prompt += self._email_block(email)
        return self.complete_with(args, self._system_prompt(), prompt)

    def draft_reply(self, args, email, tone="professional", extra=""):
        prompt = (
            f"Draft a {tone} reply to the email below. "
            f"Keep it concise, natural, and ready to send. {extra}\n\n"
        )
        prompt += self._email_block(email)
        return self.complete_with(args, self._system_prompt(), prompt)

    def rewrite(self, args, email, instruction=""):
        prompt = "Rewrite the body of the email below to be clearer and more polished."
        if instruction:
            prompt += f" {instruction}"
        prompt += "\n\nReturn only the new email body.\n\n" + self._email_block(email)
        return self.complete_with(args, self._system_prompt(), prompt)

    def change_tone(self, args, email, tone="professional"):
        prompt = f"Rewrite the email body below in a {tone} tone. " \
                f"Keep the meaning and return only the new email body.\n\n"
        prompt += self._email_block(email)
        return self.complete_with(args, self._system_prompt(), prompt)

    def translate(self, args, email, lang="English"):
        prompt = f"Translate the email body below into {lang}. " \
                f"Return only the translated body.\n\n"
        prompt += self._email_block(email)
        return self.complete_with(args, self._system_prompt(), prompt)

    def action_items(self, args, email):
        prompt = "Extract a clear bulleted list of action items from the email below. " \
                "If there are none, say so.\n\n" + self._email_block(email)
        return self.complete_with(args, self._system_prompt(), prompt)

    def deadlines(self, args, emails):
        prompt = "From the emails below, extract every deadline, due date, or time-sensitive item. " \
                "List them as bullets with the email subject and the date/time.\n\n"
        prompt += self._thread_block(emails)
        return self.complete_with(args, self._system_prompt(), prompt)

    def followup(self, args, email):
        prompt = "Draft a polite follow-up message for the email below, " \
                "checking in on the open item and proposing next steps. " \
                "Return only the follow-up email body.\n\n"
        prompt += self._email_block(email)
        return self.complete_with(args, self._system_prompt(), prompt)

    def _system_prompt(self):
        return next(
            (m["content"] for m in self.instruct if m.get("role") == "system"),
            "You are an AI email management assistant. Be concise and helpful.",
        )

    def generate(self, args, system_prompt, user_prompt, history=None):
        """Stream a generative answer for the AI email assistant.

        Used by the `mode: "generate"` request: the frontend sends the user's
        instruction (prompt) plus the real Gmail email content (context), and
        this streams a clean completion without touching the demo email store.
        """
        messages = [{"role": "system", "content": system_prompt}]
        if isinstance(history, list):
            for m in history[-6:]:
                if isinstance(m, dict) and m.get("content"):
                    messages.append({"role": m.get("role") or "user", "content": m["content"]})
        messages.append({"role": "user", "content": user_prompt})
        return self.stream(args, self._complete(messages))