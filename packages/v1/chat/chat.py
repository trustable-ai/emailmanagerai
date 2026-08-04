"""AI Email Manager — chat backend entrypoint.

Routes natural-language input through the intent parser, runs the matching
command against the in-memory email store, and returns text output. Generative
tasks (summarize, reply, rewrite, translate, tone, action items, deadlines,
follow-up) are streamed from the LLM.

Public contract (unchanged from the starter chat):
    chat(args) -> {"output": <str>, "streaming": True}

Args:
    input    : user message (string)
    messages : optional conversational context (list)
    AI_*     : LLM connection params (injected by the wrapper)
"""

import traceback

import nlp
import commands
from store import load_store, EmailStore
import llm as llm_mod


def chat(args):
    inp = args.get("input", "") or ""

    try:
        # Load the email dataset for this turn and apply it as the store.
        data = load_store()
        store = EmailStore(data)

        # Build the LLM only when a generative path is actually needed; for
        # pure data commands we skip the LLM to keep latency and cost low.
        ai = llm_mod.LLM(args)

        intent = nlp.parse(inp)
        print("intent:", intent)

        out = commands.run(args, store, ai, intent)

        # Ensure mutations persist when possible.
        try:
            store.persist()
        except Exception as exc:
            print("persist skipped:", exc)

    except Exception as e:
        traceback.print_exc()
        out = f"Error: {str(e)}\n"

    return {"output": out, "streaming": True}