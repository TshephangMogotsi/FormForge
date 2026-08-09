import { useCallback, useEffect, useRef, useState } from "react";
import { BuilderPage } from "./BuilderPage";
import type { FormDraft } from "./form-draft";
import {
  createGuestDraft,
  loadGuestDraft,
  saveGuestDraft,
  type GuestDraft
} from "./guest-draft-storage";

type GuestDialog = "account" | "reset" | null;

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

export function GuestBuilderPage({ onSignIn }: { onSignIn: () => void }) {
  const [state, setState] = useState(initializeGuestDraft);
  const [dialog, setDialog] = useState<GuestDialog>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const guestDraftRef = useRef(state.guestDraft);

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

  const accountDialog = dialog === "account";

  return (
    <main className="guest-builder-shell">
      <BuilderPage
        key={state.guestDraft.id}
        mode="guest"
        initialDraft={state.guestDraft.draft}
        onSaveDraft={saveLocalDraft}
        onStartOver={() => setDialog("reset")}
        onSignIn={onSignIn}
        onRequireAccount={() => setDialog("account")}
      />

      {state.storageWarning && (
        <div className="guest-storage-warning" role="alert">
          {state.storageWarning}
        </div>
      )}

      <dialog
        className="dashboard-dialog guest-builder-dialog"
        ref={dialogRef}
        aria-labelledby="guest-dialog-title"
        aria-describedby="guest-dialog-description"
        onCancel={(event) => {
          event.preventDefault();
          setDialog(null);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDialog(null);
        }}
      >
        <div className="dashboard-dialog-copy">
          <span className="eyebrow">
            {accountDialog ? "Your form is ready" : "Start a fresh draft"}
          </span>
          <h2 id="guest-dialog-title">
            {accountDialog ? "Create an account to publish" : "Start over?"}
          </h2>
          <p id="guest-dialog-description">
            {accountDialog
              ? "Sign in or create a free account to get a share link and collect responses. Your draft is saved on this device."
              : "This replaces the draft saved on this device. This action cannot be undone."}
          </p>
        </div>
        <div className="dashboard-dialog-actions">
          <button className="secondary-button" type="button" onClick={() => setDialog(null)}>
            {accountDialog ? "Keep editing" : "Cancel"}
          </button>
          {accountDialog ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setDialog(null);
                onSignIn();
              }}
            >
              Continue to sign in
            </button>
          ) : (
            <button className="danger-button" type="button" onClick={startOver}>
              Start over
            </button>
          )}
        </div>
      </dialog>
    </main>
  );
}
