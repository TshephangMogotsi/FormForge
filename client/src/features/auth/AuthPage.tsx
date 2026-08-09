import { useEffect, useState } from "react";
import { Blocks } from "lucide-react";
import type { User } from "../../lib/api";
import { AuthForm } from "./AuthForm";

export function AuthPage({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [initialQuery] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    return {
      resetToken: query.get("resetToken"),
      oauthError: query.get("oauthError"),
      returnTo: query.get("returnTo")
    };
  });
  useEffect(() => {
    if (initialQuery.resetToken || initialQuery.oauthError) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [initialQuery]);

  const oauthError = initialQuery.oauthError
    ? "Social sign-in could not be completed. Please try again or continue with email."
    : null;
  const socialReturnTo = initialQuery.returnTo === "/build/new"
    ? "/build/new?resume=save"
    : "/dashboard";

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

      <AuthForm
        initialError={oauthError}
        onAuthenticated={onAuthenticated}
        resetToken={initialQuery.resetToken}
        socialReturnTo={socialReturnTo}
      />
    </main>
  );
}
