import { FormEvent, useState } from "react";
import { Blocks, LoaderCircle } from "lucide-react";
import { api, type User } from "../../lib/api";

type AuthMode = "login" | "register";

export function AuthPage({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>("register");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const data = new FormData(event.currentTarget);

    try {
      const user =
        mode === "register"
          ? await api.register({
              name: String(data.get("name")),
              email: String(data.get("email")),
              password: String(data.get("password"))
            })
          : await api.login({
              email: String(data.get("email")),
              password: String(data.get("password"))
            });
      onAuthenticated(user);
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
        <span className="eyebrow">{mode === "register" ? "Create your workspace" : "Welcome back"}</span>
        <h2 id="auth-title">{mode === "register" ? "Start building" : "Sign in to FormForge"}</h2>
        <p>
          {mode === "register"
            ? "Set up your account in under a minute."
            : "Continue working on your forms."}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <label>
              Name
              <input name="name" autoComplete="name" minLength={2} maxLength={80} required />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" maxLength={254} required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              minLength={8}
              maxLength={72}
              required
            />
            {mode === "register" && <small>At least 8 characters, including a letter and number.</small>}
          </label>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button className="primary-button auth-submit" type="submit" disabled={pending}>
            {pending && <LoaderCircle className="spin" size={17} />}
            {pending ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          className="auth-switch button-reset"
          type="button"
          onClick={() => {
            setMode((current) => (current === "register" ? "login" : "register"));
            setError(null);
          }}
        >
          {mode === "register" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </section>
    </main>
  );
}
