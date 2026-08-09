import { useEffect, useState } from "react";
import { Blocks } from "lucide-react";
import type { User } from "../../lib/api";
import { AuthForm } from "./AuthForm";

export function AuthPage({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [resetToken] = useState(() =>
    new URLSearchParams(window.location.search).get("resetToken")
  );
  useEffect(() => {
    if (resetToken) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [resetToken]);

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand auth-brand">
          <span className="brand-mark">
            <Blocks size={20} strokeWidth={2.4} />
          </span>
          <span>FormForge</span>
        </div>
        <span className="eyebrow">Build, publish, learn</span>
        <h1>Turn a question into a useful conversation.</h1>
        <p>
          Create focused forms, share them anywhere, and understand every response from one
          workspace.
        </p>
        <ul>
          <li>Mobile-friendly public forms</li>
          <li>Draft-first publishing workflow</li>
          <li>Clear response insights</li>
        </ul>
      </section>

      <AuthForm onAuthenticated={onAuthenticated} resetToken={resetToken} />
    </main>
  );
}
