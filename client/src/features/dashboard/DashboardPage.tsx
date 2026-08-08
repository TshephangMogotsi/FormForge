import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode
} from "react";
import {
  BarChart3,
  ChevronRight,
  Copy,
  EllipsisVertical,
  ExternalLink,
  FileText,
  Link,
  LoaderCircle,
  Pencil,
  Plus,
  Sparkles,
  Trash2
} from "lucide-react";
import type { FormSummary, User } from "../../lib/api";

export type PendingFormAction = {
  formId: string;
  action: "copy-link" | "delete" | "duplicate" | "rename";
} | null;

type DashboardPageProps = {
  user: User;
  forms: FormSummary[];
  loading: boolean;
  creating: boolean;
  pendingAction: PendingFormAction;
  error: string | null;
  notice: string | null;
  onCreate: () => void;
  onOpen: (form: FormSummary) => void;
  onViewResponses: (form: FormSummary) => void;
  onOpenPublished: (form: FormSummary) => void;
  onCopyPublicLink: (form: FormSummary) => Promise<void>;
  onDuplicate: (form: FormSummary) => void;
  onRename: (form: FormSummary, title: string) => Promise<void>;
  onDelete: (form: FormSummary) => Promise<void>;
};

function FormActionsMenu({
  form,
  open,
  disabled,
  pendingAction,
  onOpenChange,
  onViewResponses,
  onOpenPublished,
  onCopyPublicLink,
  onRename,
  onDuplicate,
  onDelete
}: {
  form: FormSummary;
  open: boolean;
  disabled: boolean;
  pendingAction: PendingFormAction;
  onOpenChange: (open: boolean) => void;
  onViewResponses: () => void;
  onOpenPublished: () => void;
  onCopyPublicLink: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPlacement, setMenuPlacement] = useState<"above" | "below">("below");
  const menuId = `form-actions-${form.id}`;
  const isPublished = form.status === "published" && Boolean(form.slug);
  const currentAction = pendingAction?.formId === form.id ? pendingAction.action : null;

  useEffect(() => {
    if (!open) return;

    const focusFrame = window.requestAnimationFrame(() => {
      const menuBounds = menuRef.current?.getBoundingClientRect();
      const triggerBounds = triggerRef.current?.getBoundingClientRect();
      if (
        menuBounds &&
        triggerBounds &&
        menuBounds.bottom > window.innerHeight - 8 &&
        triggerBounds.top > menuBounds.height + 8
      ) {
        setMenuPlacement("above");
      }
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
        ?.focus();
    });
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      setMenuPlacement("below");
    };
  }, [open]);

  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)'
      ) ?? []
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      onOpenChange(false);
      return;
    }
    if (!items.length) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") {
      nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    items[nextIndex]?.focus();
  }

  return (
    <div className="form-card-menu" ref={containerRef}>
      <button
        className="icon-button form-card-action"
        type="button"
        ref={triggerRef}
        aria-label={`More actions for ${form.title}`}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
      >
        {currentAction ? (
          <LoaderCircle className="spin" size={18} />
        ) : (
          <EllipsisVertical size={19} />
        )}
      </button>

      {open && (
        <div
          className={
            menuPlacement === "above"
              ? "form-actions-menu align-above"
              : "form-actions-menu"
          }
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${form.title}`}
          onKeyDown={handleMenuKeyDown}
        >
          {isPublished && (
            <>
              <button role="menuitem" type="button" onClick={() => run(onViewResponses)}>
                <BarChart3 size={16} />
                View responses
              </button>
              <button role="menuitem" type="button" onClick={() => run(onOpenPublished)}>
                <ExternalLink size={16} />
                Open published form
              </button>
              <button role="menuitem" type="button" onClick={() => run(onCopyPublicLink)}>
                <Link size={16} />
                Copy public link
              </button>
              <div className="form-menu-separator" role="separator" />
            </>
          )}

          <button role="menuitem" type="button" onClick={() => run(onRename)}>
            <Pencil size={16} />
            Rename
          </button>
          <button role="menuitem" type="button" onClick={() => run(onDuplicate)}>
            <Copy size={16} />
            Duplicate
          </button>
          <div className="form-menu-separator" role="separator" />
          <button
            className="danger-menu-item"
            role="menuitem"
            type="button"
            onClick={() => run(onDelete)}
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function DashboardDialog({
  title,
  description,
  busy,
  onClose,
  children
}: {
  title: string;
  description: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      className="dashboard-dialog"
      ref={dialogRef}
      aria-labelledby="dashboard-dialog-title"
      aria-describedby="dashboard-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="dashboard-dialog-copy">
        <h2 id="dashboard-dialog-title">{title}</h2>
        <p id="dashboard-dialog-description">{description}</p>
      </div>
      {children}
    </dialog>
  );
}

export function DashboardPage({
  user,
  forms,
  loading,
  creating,
  pendingAction,
  error,
  notice,
  onCreate,
  onOpen,
  onViewResponses,
  onOpenPublished,
  onCopyPublicLink,
  onDuplicate,
  onRename,
  onDelete
}: DashboardPageProps) {
  const [openMenuFormId, setOpenMenuFormId] = useState<string | null>(null);
  const [renameForm, setRenameForm] = useState<FormSummary | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteForm, setDeleteForm] = useState<FormSummary | null>(null);
  const renaming = pendingAction?.action === "rename";
  const deleting = pendingAction?.action === "delete";

  function requestRename(form: FormSummary) {
    setRenameTitle(form.title);
    setRenameForm(form);
  }

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameForm || !renameTitle.trim()) return;
    try {
      await onRename(renameForm, renameTitle.trim());
      setRenameForm(null);
    } catch {
      // The dashboard error banner presents API failures while the dialog stays open.
    }
  }

  async function confirmDelete() {
    if (!deleteForm) return;
    try {
      await onDelete(deleteForm);
      setDeleteForm(null);
    } catch {
      // The dashboard error banner presents API failures while the dialog stays open.
    }
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">Your workspace</span>
          <h1>Good to see you, {user.name.split(" ")[0]}.</h1>
          <p>Build something worth responding to.</p>
        </div>
        <button className="primary-button" type="button" onClick={onCreate} disabled={creating}>
          {creating ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />}
          {creating ? "Creating…" : "New form"}
        </button>
      </header>

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="dashboard-notice" role="status">
          {notice}
        </div>
      )}

      <section className="metric-grid" aria-label="Workspace overview">
        <article className="metric-card">
          <span className="metric-label">Total forms</span>
          <strong>{forms.length}</strong>
          <small>{forms.length ? "Across drafts and published forms" : "Your first form starts here"}</small>
        </article>
        <article className="metric-card">
          <span className="metric-label">Published forms</span>
          <strong>{forms.filter((form) => form.status === "published").length}</strong>
          <small>Live and ready to collect responses</small>
        </article>
        <article className="metric-card accent-card">
          <span className="sparkle-badge">
            <Sparkles size={15} /> Quick start
          </span>
          <strong>Build in minutes</strong>
          <small>Drag, configure, publish.</small>
        </article>
      </section>

      <section className="forms-section">
        <div className="section-heading">
          <div>
            <h2>Recent forms</h2>
            <p>Your drafts and published forms appear here.</p>
          </div>
        </div>

        {loading ? (
          <div className="forms-loading" aria-live="polite">
            <LoaderCircle className="spin" size={20} /> Loading your forms…
          </div>
        ) : forms.length ? (
          <div className="form-card-grid">
            {forms.map((form) => (
              <article
                className={openMenuFormId === form.id ? "form-card menu-open" : "form-card"}
                key={form.id}
              >
                <button
                  className="form-card-open button-reset"
                  type="button"
                  onClick={() => onOpen(form)}
                >
                  <span className="empty-icon">
                    <FileText size={22} />
                  </span>
                  <span className="form-card-copy">
                    <strong>{form.title}</strong>
                    <small>{form.description || "No description yet"}</small>
                  </span>
                  <span className={`status-pill ${form.status}`}>{form.status}</span>
                  <ChevronRight size={17} />
                </button>
                <FormActionsMenu
                  form={form}
                  open={openMenuFormId === form.id}
                  disabled={pendingAction !== null}
                  pendingAction={pendingAction}
                  onOpenChange={(open) => setOpenMenuFormId(open ? form.id : null)}
                  onViewResponses={() => onViewResponses(form)}
                  onOpenPublished={() => onOpenPublished(form)}
                  onCopyPublicLink={() => void onCopyPublicLink(form)}
                  onRename={() => requestRename(form)}
                  onDuplicate={() => onDuplicate(form)}
                  onDelete={() => setDeleteForm(form)}
                />
              </article>
            ))}
          </div>
        ) : (
          <button className="empty-state empty-state-button" type="button" onClick={onCreate}>
            <span className="empty-icon">
              <FileText size={28} />
            </span>
            <h3>Create your first form</h3>
            <p>Add fields, shape the experience, and share it with the world.</p>
            <span className="text-link">
              Open the builder <ChevronRight size={16} />
            </span>
          </button>
        )}
      </section>

      {renameForm && (
        <DashboardDialog
          title="Rename form"
          description="Choose a clear name that will be easy to recognize in your workspace."
          busy={renaming}
          onClose={() => setRenameForm(null)}
        >
          <form className="dashboard-dialog-form" onSubmit={submitRename}>
            <label htmlFor="rename-form-title">
              Form name
              <input
                id="rename-form-title"
                autoFocus
                required
                maxLength={120}
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
              />
            </label>
            <div className="dashboard-dialog-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={renaming}
                onClick={() => setRenameForm(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={renaming || !renameTitle.trim()}
              >
                {renaming && <LoaderCircle className="spin" size={16} />}
                Rename
              </button>
            </div>
          </form>
        </DashboardDialog>
      )}

      {deleteForm && (
        <DashboardDialog
          title={`Delete “${deleteForm.title}”?`}
          description="This permanently removes the form, every published version, all submissions, and its analytics. This action cannot be undone."
          busy={deleting}
          onClose={() => setDeleteForm(null)}
        >
          <div className="dashboard-dialog-actions">
            <button
              className="secondary-button"
              type="button"
              autoFocus
              disabled={deleting}
              onClick={() => setDeleteForm(null)}
            >
              Cancel
            </button>
            <button
              className="danger-button"
              type="button"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting && <LoaderCircle className="spin" size={16} />}
              Delete form
            </button>
          </div>
        </DashboardDialog>
      )}
    </div>
  );
}
