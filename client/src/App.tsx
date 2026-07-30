import { useEffect, useState } from "react";
import {
  BarChart3,
  Blocks,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Plus,
  Settings,
  Sparkles
} from "lucide-react";
import { AuthPage } from "./features/auth/AuthPage";
import { BuilderPage } from "./features/builder/BuilderPage";
import { api, type FormSummary, type User } from "./lib/api";

type View = "dashboard" | "builder";

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
  onLogout
}: {
  children: React.ReactNode;
  view: View;
  user: User;
  onNavigate: (view: View) => void;
  onLogout: () => void;
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
            className={!isBuilder ? "nav-item active button-reset" : "nav-item button-reset"}
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
          <span className="nav-item muted">
            <BarChart3 size={18} />
            Analytics
            <span className="soon">Soon</span>
          </span>
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
  error,
  onCreate,
  onOpen
}: {
  user: User;
  forms: FormSummary[];
  loading: boolean;
  creating: boolean;
  error: string | null;
  onCreate: () => void;
  onOpen: (form: FormSummary) => void;
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
          <span className="metric-label">Responses</span>
          <strong>0</strong>
          <small>Across all published forms</small>
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
              <button className="form-card" type="button" key={form.id} onClick={() => onOpen(form)}>
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
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<FormSummary | null>(null);

  useEffect(() => {
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

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setActiveForm(null);
      setView("dashboard");
    }
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
    <AppShell view={view} user={user} onNavigate={setView} onLogout={handleLogout}>
      {view === "dashboard" ? (
        <DashboardPage
          user={user}
          forms={forms}
          loading={formsLoading}
          creating={creating}
          error={error}
          onCreate={handleCreate}
          onOpen={(form) => {
            setActiveForm(form);
            setView("builder");
          }}
        />
      ) : (
        <BuilderPage
          formTitle={activeForm?.title ?? "Untitled form"}
          onBack={() => setView("dashboard")}
        />
      )}
    </AppShell>
  );
}
