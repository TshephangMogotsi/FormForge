import { FormEvent, useState } from "react";
import { LoaderCircle, MailCheck } from "lucide-react";
import { api, type User } from "../../lib/api";

export function EmailVerificationPrompt({
  user,
  onUserUpdated,
  onVerified,
  onDismiss
}: {
  user: User;
  onUserUpdated: (user: User) => void;
  onVerified: () => void;
  onDismiss: () => void;
}) {
  const [pending, setPending] = useState<"check" | "resend" | "change" | null>(null);
  const [changingEmail, setChangingEmail] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkVerification() {
    setPending("check");
    setError(null);
    try {
      const currentUser = await api.me();
      onUserUpdated(currentUser);
      if (!currentUser.emailVerifiedAt) {
        setError("That email is not verified yet. Open the newest link we sent, then try again.");
        return;
      }
      onVerified();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Verification could not be checked.");
    } finally {
      setPending(null);
    }
  }

  async function resend() {
    setPending("resend");
    setError(null);
    try {
      const result = await api.requestEmailVerification();
      onUserUpdated(result.user);
      if (result.user.emailVerifiedAt) {
        onVerified();
        return;
      }
      setNotice(`A new verification link was sent to ${result.user.email}.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "A new link could not be sent.");
    } finally {
      setPending(null);
    }
  }

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending("change");
    setError(null);
    try {
      const result = await api.changeEmail({
        email: String(data.get("email")),
        password: String(data.get("password"))
      });
      onUserUpdated(result.user);
      setChangingEmail(false);
      setNotice(`Email updated. A verification link was sent to ${result.user.email}.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Your email could not be changed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="verification-prompt" aria-labelledby="verification-title">
      <span className="verification-icon"><MailCheck size={23} /></span>
      <span className="eyebrow">One last trust check</span>
      <h2 id="verification-title">Verify your email to publish</h2>
      <p>
        Your form is safely saved to your account but is not public yet. Open the newest
        verification link sent to <strong>{user.email}</strong>.
      </p>

      {error && <div className="auth-error" role="alert">{error}</div>}
      {notice && <div className="auth-notice" role="status">{notice}</div>}

      {changingEmail ? (
        <form className="verification-change-form" onSubmit={changeEmail}>
          <label>
            Correct email
            <input name="email" type="email" defaultValue={user.email} maxLength={254} required />
          </label>
          <label>
            Current password
            <input name="password" type="password" autoComplete="current-password" maxLength={72} required />
          </label>
          <div className="dashboard-dialog-actions">
            <button className="secondary-button" type="button" onClick={() => setChangingEmail(false)}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={pending !== null}>
              {pending === "change" && <LoaderCircle className="spin" size={17} />}
              Update email
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="verification-actions">
            <button className="primary-button" type="button" disabled={pending !== null} onClick={() => void checkVerification()}>
              {pending === "check" && <LoaderCircle className="spin" size={17} />}
              I’ve verified my email
            </button>
            <button className="secondary-button" type="button" disabled={pending !== null} onClick={() => void resend()}>
              {pending === "resend" && <LoaderCircle className="spin" size={17} />}
              Resend link
            </button>
          </div>
          <button className="auth-switch button-reset" type="button" onClick={() => setChangingEmail(true)}>
            Sent to the wrong address? Change email
          </button>
          <button className="guest-auth-dismiss button-reset" type="button" onClick={onDismiss}>
            Keep editing for now
          </button>
        </>
      )}

      <p className="verification-policy-copy">
        Publishing means agreeing to FormForge’s <a href="/acceptable-use">acceptable-use rules</a>.
        Guest drafts remain on this device until you save them to an account.
      </p>
    </section>
  );
}
