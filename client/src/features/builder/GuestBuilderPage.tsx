import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { AuthForm } from "../auth/AuthForm";
import { api, type FormSummary, type User } from "../../lib/api";
import { BuilderPage, type BuilderIntent } from "./BuilderPage";
import type { FormDraft } from "./form-draft";
import {
  createGuestDraft,
  clearGuestDraft,
  loadGuestDraft,
  saveGuestDraft,
  type GuestDraft
} from "./guest-draft-storage";

type GuestDialog = "auth" | "reset" | null;
type ClaimState = "idle" | "pending" | "error";

function initializeGuestDraft(): {
  guestDraft: GuestDraft;
  storageWarning: string | null;
} {
  const loaded = loadGuestDraft();
  if (loaded.ok && loaded.value) {
    return { guestDraft: loaded.value, storageWarning: null };
  }

  const guestDraft = createGuestDraft();
  const saved = saveGuestDraft(guestDraft);
  if (!loaded.ok || !saved.ok) {
    return {
      guestDraft,
      storageWarning:
        "This browser couldn’t restore local draft storage. Keep this tab open to avoid losing changes."
    };
  }

  return { guestDraft, storageWarning: null };
}

export function GuestBuilderPage({
  user,
  onClaimed
}: {
  user: User | null;
  onClaimed: (user: User, form: FormSummary, intent: BuilderIntent) => void;
}) {
  const [state, setState] = useState(initializeGuestDraft);
  const [dialog, setDialog] = useState<GuestDialog>(null);
  const [claimUser, setClaimUser] = useState<User | null>(null);
  const [claimState, setClaimState] = useState<ClaimState>("idle");
  const [claimError, setClaimError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const guestDraftRef = useRef(state.guestDraft);
  const pendingIntentRef = useRef<BuilderIntent>("save");

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (dialog && !element.open) element.showModal();
    if (!dialog && element.open) element.close();
  }, [dialog]);

  const saveLocalDraft = useCallback((draft: FormDraft) => {
    const nextGuestDraft: GuestDraft = {
      ...guestDraftRef.current,
      draft,
      updatedAt: new Date().toISOString()
    };
    guestDraftRef.current = nextGuestDraft;
    const result = saveGuestDraft(nextGuestDraft);
    setState({
      guestDraft: nextGuestDraft,
      storageWarning: result.ok
        ? null
        : "This browser blocked local draft storage. Keep this tab open to avoid losing changes."
    });
    return result.ok;
  }, []);

  function startOver() {
    const guestDraft = createGuestDraft();
    guestDraftRef.current = guestDraft;
    const result = saveGuestDraft(guestDraft);
    setState({
      guestDraft,
      storageWarning: result.ok
        ? null
        : "This browser blocked local draft storage. Keep this tab open to avoid losing changes."
    });
    setDialog(null);
  }

  async function claimDraft(authenticatedUser: User) {
    setClaimUser(authenticatedUser);
    setClaimState("pending");
    setClaimError(null);
    try {
      const guestDraft = guestDraftRef.current;
      const form = await api.claimGuestDraft(guestDraft.id, guestDraft.draft);
      clearGuestDraft();
      onClaimed(authenticatedUser, form, pendingIntentRef.current);
    } catch (caughtError) {
      setClaimState("error");
      setClaimError(
        caughtError instanceof Error
          ? caughtError.message
          : "Your form could not be saved. Please try again."
      );
    }
  }

  function requireAccount(draft: FormDraft, intent: BuilderIntent) {
    saveLocalDraft(draft);
    pendingIntentRef.current = intent;
    setDialog("auth");
    setClaimError(null);
    if (user) void claimDraft(user);
    else {
      setClaimUser(null);
      setClaimState("idle");
    }
  }

  const authDialog = dialog === "auth";
  const claimPending = claimState === "pending";

  return (
    <main className="guest-builder-shell">
      <BuilderPage
        key={state.guestDraft.id}
        mode="guest"
        initialDraft={state.guestDraft.draft}
        onSaveDraft={saveLocalDraft}
        onStartOver={() => setDialog("reset")}
        accountActionLabel={user ? "Save to account" : "Sign in"}
        onRequireAccount={requireAccount}
      />

      {state.storageWarning && (
        <div className="guest-storage-warning" role="alert">
          {state.storageWarning}
        </div>
      )}

      <dialog
        className="dashboard-dialog guest-builder-dialog"
        ref={dialogRef}
        aria-label={authDialog ? "Save this form to your account" : undefined}
        aria-labelledby={authDialog ? undefined : "guest-dialog-title"}
        onCancel={(event) => {
          event.preventDefault();
          if (!claimPending) setDialog(null);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !claimPending) setDialog(null);
        }}
      >
        {authDialog ? (
          claimUser ? (
            <section className="guest-claim-status" aria-labelledby="guest-dialog-title">
              <span className="eyebrow">Saving your progress</span>
              <h2 id="guest-dialog-title">
                {claimPending ? "Adding this form to your account…" : "We couldn’t save your form"}
              </h2>
              {claimPending ? (
                <div className="guest-claim-loading" role="status">
                  <LoaderCircle className="spin" size={20} />
                  Your local draft is safe while we connect it to your account.
                </div>
              ) : (
                <>
                  <div className="auth-error" role="alert">
                    {claimError ?? "Your form could not be saved. Please try again."}
                  </div>
                  <p>Your draft is still saved on this device. You do not need to sign in again.</p>
                  <div className="dashboard-dialog-actions">
                    <button className="secondary-button" type="button" onClick={() => setDialog(null)}>
                      Keep editing
                    </button>
                    <button className="primary-button" type="button" onClick={() => void claimDraft(claimUser)}>
                      Retry saving
                    </button>
                  </div>
                </>
              )}
            </section>
          ) : (
            <div className="guest-auth-frame">
              <AuthForm context="guest" onAuthenticated={(authenticatedUser) => void claimDraft(authenticatedUser)} />
              <button className="guest-auth-dismiss button-reset" type="button" onClick={() => setDialog(null)}>
                Keep editing without an account
              </button>
            </div>
          )
        ) : (
          <>
            <div className="dashboard-dialog-copy">
              <span className="eyebrow">Start a fresh draft</span>
              <h2 id="guest-dialog-title">Start over?</h2>
              <p>This replaces the draft saved on this device. This action cannot be undone.</p>
            </div>
            <div className="dashboard-dialog-actions">
              <button className="secondary-button" type="button" onClick={() => setDialog(null)}>
                Cancel
              </button>
            <button className="danger-button" type="button" onClick={startOver}>
              Start over
            </button>
            </div>
          </>
        )}
      </dialog>
    </main>
  );
}
