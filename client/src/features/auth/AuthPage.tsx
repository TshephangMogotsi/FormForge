import { FormEvent, useEffect, useState } from "react";
import { Blocks, LoaderCircle } from "lucide-react";
import { api, type User } from "../../lib/api";

type AuthMode = "login" | "register" | "forgot" | "reset";

const modeCopy: Record<AuthMode, { eyebrow: string; title: string; description: string }> = {
  register: {
    eyebrow: "Create your workspace",
    title: "Start building",
    description: "Set up your account in under a minute."
  },
  login: {
    eyebrow: "Welcome back",
    title: "Sign in to FormForge",
    description: "Continue working on your forms."
  },
  forgot: {
    eyebrow: "Account recovery",
    title: "Reset your password",
    description: "Enter your account email and we’ll send you a secure reset link."
  },
  reset: {
    eyebrow: "Choose a new password",
    title: "Secure your account",
    description: "This reset link can only be used once."
  }
};

export function AuthPage({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [resetToken] = useState(() =>
    new URLSearchParams(window.location.search).get("resetToken")
  );
  const [mode, setMode] = useState<AuthMode>(resetToken ? "reset" : "register");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const copy = modeCopy[mode];

  useEffect(() => {
    if (resetToken) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [resetToken]);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");

    if ((mode === "register" || mode === "reset") && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);

    try {
      if (mode === "register") {
        const user = await api.register({
          name: String(data.get("name")),
          email: String(data.get("email")),
          password,
          confirmPassword
        });
        onAuthenticated(user);
        return;
      }

      if (mode === "login") {
        const user = await api.login({
          email: String(data.get("email")),
          password
        });
        onAuthenticated(user);
        return;
      }

      if (mode === "forgot") {
        const message = await api.forgotPassword(String(data.get("email")));
        setNotice(message);
        return;
      }

      if (!resetToken) {
        setError("This password reset link is invalid or has expired.");
        return;
      }

      await api.resetPassword({
        token: resetToken,
        password,
        confirmPassword
      });
      changeMode("login");
      setNotice("Your password has been reset. Sign in with your new password.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Authentication failed.");
    } finally {
      setPending(false);
    }
  }

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

      <section className="auth-card" aria-labelledby="auth-title">
        <span className="eyebrow">{copy.eyebrow}</span>
        <h2 id="auth-title">{copy.title}</h2>
        <p>{copy.description}</p>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <label>
              Name
              <input name="name" autoComplete="name" minLength={2} maxLength={80} required />
            </label>
          )}

          {mode !== "reset" && (
            <label>
              Email
              <input name="email" type="email" autoComplete="email" maxLength={254} required />
            </label>
          )}

          {mode !== "forgot" && (
            <label>
              {mode === "reset" ? "New password" : "Password"}
              <input
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "login" ? 1 : 8}
                maxLength={72}
                required
              />
              {(mode === "register" || mode === "reset") && (
                <small>At least 8 characters, including a letter and number.</small>
              )}
            </label>
          )}

          {(mode === "register" || mode === "reset") && (
            <label>
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
              />
            </label>
          )}

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          {notice && (
            <div className="auth-notice" role="status">
              {notice}
            </div>
          )}

          <button className="primary-button auth-submit" type="submit" disabled={pending}>
            {pending && <LoaderCircle className="spin" size={17} />}
            {pending
              ? "Please wait…"
              : mode === "register"
                ? "Create account"
                : mode === "login"
                  ? "Sign in"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Reset password"}
          </button>
        </form>

        <div className="auth-secondary-actions">
          {mode === "login" && (
            <button
              className="auth-switch button-reset"
              type="button"
              onClick={() => changeMode("forgot")}
            >
              Forgot your password?
            </button>
          )}

          {(mode === "forgot" || mode === "reset") && (
            <button
              className="auth-switch button-reset"
              type="button"
              onClick={() => changeMode("login")}
            >
              Back to sign in
            </button>
          )}

          {(mode === "login" || mode === "register") && (
            <button
              className="auth-switch button-reset"
              type="button"
              onClick={() => changeMode(mode === "register" ? "login" : "register")}
            >
              {mode === "register"
                ? "Already have an account? Sign in"
                : "New here? Create an account"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
