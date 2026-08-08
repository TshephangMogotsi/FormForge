import { lazy, Suspense, useEffect, useState } from "react";
import {
  BarChart3,
  Blocks,
  ChevronRight,
  Copy,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Plus,
  Settings,
  Sparkles
} from "lucide-react";
import { AuthPage } from "./features/auth/AuthPage";
import { api, type FormSummary, type User } from "./lib/api";

const BuilderPage = lazy(() =>
  import("./features/builder/BuilderPage").then((module) => ({ default: module.BuilderPage }))
);
const PublicFormPage = lazy(() =>
  import("./features/public/PublicFormPage").then((module) => ({ default: module.PublicFormPage }))
);
const ResponsesPage = lazy(() =>
  import("./features/responses/ResponsesPage").then((module) => ({ default: module.ResponsesPage }))
);

const publicFormSlug = window.location.pathname.match(
  /^\/f\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/
)?.[1] ?? null;

type View = "dashboard" | "builder" | "responses";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function AppShell({
  children,
  view,
  user,
  onNavigate,
  onLogout,
  hasActiveForm
}: {
  children: React.ReactNode;
  view: View;
  user: User;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  hasActiveForm: boolean;
}) {
  const isBuilder = view === "builder";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand button-reset brand-button" type="button" onClick={() => onNavigate("dashboard")}>
          <span className="brand-mark">
            <Blocks size={20} strokeWidth={2.4} />
          </span>
          <span>FormForge</span>
        </button>

        <nav className="nav-list" aria-label="Primary navigation">
          <button
            className={view === "dashboard" ? "nav-item active button-reset" : "nav-item button-reset"}
            type="button"
            onClick={() => onNavigate("dashboard")}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button
            className={isBuilder ? "nav-item active button-reset" : "nav-item button-reset"}
            type="button"
            onClick={() => onNavigate("builder")}
          >
            <FileText size={18} />
            Forms
          </button>
          <button
            className={view === "responses" ? "nav-item active button-reset" : "nav-item button-reset"}
            type="button"
            disabled={!hasActiveForm}
            onClick={() => onNavigate("responses")}
          >
            <BarChart3 size={18} />
            Analytics
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item button-reset" type="button">
            <Settings size={18} />
            Settings
          </button>
          <div className="profile">
            <span className="avatar">{initials(user.name)}</span>
            <span className="profile-copy">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
            <button className="icon-button" type="button" onClick={onLogout} aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

function DashboardPage({
  user,
  forms,
  loading,
  creating,
  duplicatingFormId,
  error,
  onCreate,
  onOpen,
  onDuplicate
}: {
  user: User;
  forms: FormSummary[];
  loading: boolean;
  creating: boolean;
  duplicatingFormId: string | null;
  error: string | null;
  onCreate: () => void;
  onOpen: (form: FormSummary) => void;
  onDuplicate: (form: FormSummary) => void;
}) {
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
              <article className="form-card" key={form.id}>
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
                <button
                  className="icon-button form-card-action"
                  type="button"
                  aria-label={`Duplicate ${form.title}`}
                  title="Duplicate form"
                  disabled={duplicatingFormId === form.id}
                  onClick={() => onDuplicate(form)}
                >
                  {duplicatingFormId === form.id ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Copy size={17} />
                  )}
                </button>
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
    </div>
  );
}

function AppLoading() {
  return (
    <main className="app-loading" aria-live="polite">
      <span className="brand-mark">
        <Blocks size={22} />
      </span>
      <LoaderCircle className="spin" size={20} />
      <span>Opening FormForge…</span>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(publicFormSlug === null);
  const [view, setView] = useState<View>("dashboard");
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [duplicatingFormId, setDuplicatingFormId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<FormSummary | null>(null);

  useEffect(() => {
    if (publicFormSlug) return;
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setForms([]);
      return;
    }

    setFormsLoading(true);
    setError(null);
    api
      .listForms()
      .then(({ forms: loadedForms }) => setForms(loadedForms))
      .catch((caughtError) =>
        setError(caughtError instanceof Error ? caughtError.message : "Forms could not be loaded.")
      )
      .finally(() => setFormsLoading(false));
  }, [user]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const form = await api.createForm({ title: "Untitled form" });
      setForms((current) => [form, ...current]);
      setActiveForm(form);
      setView("builder");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "The form could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(form: FormSummary) {
    setDuplicatingFormId(form.id);
    setError(null);
    try {
      const duplicate = await api.duplicateForm(form.id);
      setForms((current) => [duplicate, ...current]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The form could not be duplicated."
      );
    } finally {
      setDuplicatingFormId(null);
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setActiveForm(null);
      setView("dashboard");
    }
  }

  if (publicFormSlug) {
    return (
      <Suspense fallback={<AppLoading />}>
        <PublicFormPage slug={publicFormSlug} />
      </Suspense>
    );
  }
  if (checkingSession) return <AppLoading />;
  if (!user) {
    return (
      <AuthPage
        onAuthenticated={(authenticatedUser) => {
          setUser(authenticatedUser);
          setView("dashboard");
        }}
      />
    );
  }

  return (
    <AppShell
      view={view}
      user={user}
      onNavigate={setView}
      onLogout={handleLogout}
      hasActiveForm={Boolean(activeForm)}
    >
      {view === "dashboard" || !activeForm ? (
        <DashboardPage
          user={user}
          forms={forms}
          loading={formsLoading}
          creating={creating}
          duplicatingFormId={duplicatingFormId}
          error={error}
          onCreate={handleCreate}
          onDuplicate={handleDuplicate}
          onOpen={(form) => {
            setActiveForm(form);
            setView("builder");
          }}
        />
      ) : view === "builder" ? (
        <Suspense fallback={<AppLoading />}>
          <BuilderPage
            formId={activeForm.id}
            onBack={() => setView("dashboard")}
            onOpenResponses={() => setView("responses")}
            onSaved={(savedForm) => {
              setActiveForm(savedForm);
              setForms((current) =>
                current.map((form) => (form.id === savedForm.id ? savedForm : form))
              );
            }}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<AppLoading />}>
          <ResponsesPage
            form={activeForm}
            onBack={() => setView("dashboard")}
            onEdit={() => setView("builder")}
          />
        </Suspense>
      )}
    </AppShell>
  );
}
