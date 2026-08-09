import { useEffect, useState } from "react";
import { Blocks, CheckCircle2, LoaderCircle } from "lucide-react";
import { api } from "../../lib/api";

export function EmailVerificationPage({
  onVerified
}: {
  onVerified: () => void;
}) {
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("Checking your verification link…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    window.history.replaceState({}, "", window.location.pathname);
    if (!token) {
      setStatus("error");
      setMessage("This verification link is incomplete. Request a new link from the builder.");
      return;
    }

    api.verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Your email is verified. You can now publish forms.");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "This verification link could not be used.");
      });
  }, []);

  return (
    <main className="verification-page">
      <div className="brand">
        <span className="brand-mark"><Blocks size={20} /></span>
        <span>FormForge</span>
      </div>
      <section className="verification-page-card" aria-live="polite">
        {status === "pending" ? <LoaderCircle className="spin" size={30} /> : <CheckCircle2 size={30} />}
        <span className="eyebrow">Email verification</span>
        <h1>{status === "success" ? "You’re verified" : status === "error" ? "Link unavailable" : "Just a moment"}</h1>
        <p>{message}</p>
        {status === "success" && (
          <button className="primary-button" type="button" onClick={onVerified}>
            Continue to FormForge
          </button>
        )}
        {status === "error" && <a className="secondary-button" href="/">Return to FormForge</a>}
      </section>
    </main>
  );
}
