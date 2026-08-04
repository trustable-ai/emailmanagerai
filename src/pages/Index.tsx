import { useAuth } from "@/services/auth/AuthContext";
import { Login } from "@/components/mail/Login";
import { MailClient } from "@/components/mail/MailClient";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, initializing, validating } = useAuth();

  if (initializing || validating) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {validating ? "Restoring your session…" : "Loading…"}
          </p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return <MailClient />;
};

export default Index;