import { FormEvent, useState } from "react";
import { Blocks, LoaderCircle } from "lucide-react";
import { api } from "../../lib/api";

type TrustPageKind = "privacy" | "acceptable-use" | "report-abuse";

export function TrustPage({ kind }: { kind: TrustPageKind }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const initialSlug = new URLSearchParams(window.location.search).get("form") ?? "";

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api.reportAbuse(String(data.get("slug")), {
        reason: String(data.get("reason")) as "spam" | "phishing" | "harmful" | "other",
        details: String(data.get("details")),
        reporterEmail: String(data.get("reporterEmail"))
      });
      setSubmitted(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "The report could not be submitted.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="trust-page">
      <a className="brand" href="/">
        <span className="brand-mark"><Blocks size={20} /></span>
        <span>FormForge</span>
      </a>
      <article className="trust-card">
        {kind === "privacy" ? (
          <>
            <span className="eyebrow">Privacy</span>
            <h1>What FormForge stores</h1>
            <p>Guest drafts remain in this browser until you choose to save them to an account.</p>
            <h2>Account owners</h2>
            <p>FormForge stores account details, form drafts, published snapshots, and responses needed to provide the service. Passwords are stored only as secure hashes.</p>
            <h2>Respondents</h2>
            <p>Answers are shared with the owner of the form. Do not submit passwords, financial credentials, government identifiers, or other highly sensitive information.</p>
            <h2>Operational data</h2>
            <p>Security and reliability logs use request metadata and correlation identifiers. They do not intentionally include passwords, authentication tokens, or raw form responses.</p>
          </>
        ) : kind === "acceptable-use" ? (
          <>
            <span className="eyebrow">Acceptable use</span>
            <h1>Build forms people can trust</h1>
            <p>Do not use FormForge for phishing, credential collection, spam, impersonation, unlawful content, harassment, malware, or attempts to bypass service limits.</p>
            <p>Forms collecting highly sensitive personal, financial, health, or government-identity information are not appropriate for this public trial.</p>
            <p>FormForge may unpublish or remove abusive forms and restrict accounts that create risk for respondents or the service.</p>
            <a className="secondary-button" href="/report-abuse">Report an abusive form</a>
          </>
        ) : submitted ? (
          <>
            <span className="eyebrow">Report received</span>
            <h1>Thank you for flagging this form</h1>
            <p>The report has been recorded for review. Do not submit information to a form you believe is unsafe.</p>
            <a className="secondary-button" href="/">Return to FormForge</a>
          </>
        ) : (
          <>
            <span className="eyebrow">Report abuse</span>
            <h1>Flag an unsafe public form</h1>
            <p>Reports are limited and reviewed for public-trial safety. Include only what is needed to identify the concern.</p>
            <form className="trust-report-form" onSubmit={submitReport}>
              <label>
                Public form identifier
                <input name="slug" defaultValue={initialSlug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
              </label>
              <label>
                Reason
                <select name="reason" required defaultValue="">
                  <option value="" disabled>Choose a reason</option>
                  <option value="phishing">Phishing or credential collection</option>
                  <option value="spam">Spam or deceptive promotion</option>
                  <option value="harmful">Harmful or unlawful content</option>
                  <option value="other">Other safety concern</option>
                </select>
              </label>
              <label>
                Details (optional)
                <textarea name="details" rows={4} maxLength={1000} />
              </label>
              <label>
                Your email (optional)
                <input name="reporterEmail" type="email" maxLength={254} />
              </label>
              {error && <div className="auth-error" role="alert">{error}</div>}
              <button className="primary-button" type="submit" disabled={pending}>
                {pending && <LoaderCircle className="spin" size={17} />}
                {pending ? "Submitting…" : "Submit report"}
              </button>
            </form>
          </>
        )}
        <nav className="trust-links" aria-label="Trust and safety">
          <a href="/privacy">Privacy</a>
          <a href="/acceptable-use">Acceptable use</a>
          <a href="/report-abuse">Report abuse</a>
        </nav>
      </article>
    </main>
  );
}
