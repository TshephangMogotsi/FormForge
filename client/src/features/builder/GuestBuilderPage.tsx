import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { AuthForm } from "../auth/AuthForm";
import { api, type FormSummary, type User } from "../../lib/api";
import { failureCategory, trackFunnelEvent } from "../../lib/funnel";
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
  const oauthQueryRef = useRef(
    (() => {
      const query = new URLSearchParams(window.location.search);
      const resumeCandidate = query.get("resume");
      const resume: BuilderIntent | null =
        resumeCandidate === "save" || resumeCandidate === "publish"
          ? resumeCandidate
          : null;
      return {
        resume,
        error: query.get("oauthError")
      };
    })()
  );
  const [state, setState] = useState(initializeGuestDraft);
  const [dialog, setDialog] = useState<GuestDialog>(
    oauthQueryRef.current.error ? "auth" : null
  );
  const [claimUser, setClaimUser] = useState<User | null>(null);
  const [claimState, setClaimState] = useState<ClaimState>("idle");
  const [claimError, setClaimError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const guestDraftRef = useRef(state.guestDraft);
  const initialDraftSnapshotRef = useRef(JSON.stringify(state.guestDraft.draft));
  const builderOpenedTrackedRef = useRef(false);
  const meaningfulEditTrackedRef = useRef(false);
  const storageFailureTrackedRef = useRef(false);
  const oauthResumeStartedRef = useRef(false);
  const pendingIntentRef = useRef<BuilderIntent>("save");

  useEffect(() => {
    if (builderOpenedTrackedRef.current) return;
    builderOpenedTrackedRef.current = true;
    trackFunnelEvent("builder_opened");
  }, []);

  useEffect(() => {
    if (!state.storageWarning || storageFailureTrackedRef.current) return;
    storageFailureTrackedRef.current = true;
    trackFunnelEvent("draft_storage_failed", "storage");
  }, [state.storageWarning]);

  useEffect(() => {
    const resume = oauthQueryRef.current.resume;
    if (!user || !resume || oauthResumeStartedRef.current) return;
    oauthResumeStartedRef.current = true;
    pendingIntentRef.current = resume;
    window.history.replaceState({}, "", "/build/new");
    trackFunnelEvent("auth_succeeded");
    void claimDraft(user);
  }, [user]);

  useEffect(() => {
    if (!oauthQueryRef.current.error) return;
    window.history.replaceState({}, "", "/build/new");
    trackFunnelEvent("auth_failed", "authentication");
  }, []);

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (dialog && !element.open) element.showModal();
    if (!dialog && element.open) element.close();
  }, [dialog]);

  const saveLocalDraft = useCallback((draft: FormDraft) => {
    if (
      !meaningfulEditTrackedRef.current &&
      JSON.stringify(draft) !== initialDraftSnapshotRef.current
    ) {
      meaningfulEditTrackedRef.current = true;
      trackFunnelEvent("first_meaningful_edit");
    }
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
    initialDraftSnapshotRef.current = JSON.stringify(guestDraft.draft);
    meaningfulEditTrackedRef.current = false;
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
      trackFunnelEvent("draft_claimed");
      clearGuestDraft();
      onClaimed(authenticatedUser, form, pendingIntentRef.current);
    } catch (caughtError) {
      trackFunnelEvent("claim_failed", failureCategory(caughtError));
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
    if (intent === "publish") trackFunnelEvent("publish_selected");
    pendingIntentRef.current = intent;
    setDialog("auth");
    setClaimError(null);
    if (user) void claimDraft(user);
    else {
      trackFunnelEvent("auth_prompt_shown");
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
              <AuthForm
                context="guest"
                initialError={oauthQueryRef.current.error
                  ? "Social sign-in could not be completed. Please try again or continue with email."
                  : null}
                onAuthenticated={(authenticatedUser) => {
                  trackFunnelEvent("auth_succeeded");
                  void claimDraft(authenticatedUser);
                }}
                onAuthenticationFailed={(error) => {
                  trackFunnelEvent("auth_failed", failureCategory(error));
                }}
                socialReturnTo={`/build/new?resume=${pendingIntentRef.current}`}
              />
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
