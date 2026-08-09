import { lazy, Suspense, useEffect, useState } from "react";
import {
  BarChart3,
  Blocks,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Settings
} from "lucide-react";
import { AuthPage } from "./features/auth/AuthPage";
import {
  DashboardPage,
  type PendingFormAction
} from "./features/dashboard/DashboardPage";
import { AnalyticsOverviewPage } from "./features/responses/AnalyticsOverviewPage";
import { api, type FormSummary, type User } from "./lib/api";

const BuilderPage = lazy(() =>
  import("./features/builder/BuilderPage").then((module) => ({ default: module.BuilderPage }))
);
const GuestBuilderPage = lazy(() =>
  import("./features/builder/GuestBuilderPage").then((module) => ({
    default: module.GuestBuilderPage
  }))
);
const PublicFormPage = lazy(() =>
  import("./features/public/PublicFormPage").then((module) => ({ default: module.PublicFormPage }))
);
const ResponsesPage = lazy(() =>
  import("./features/responses/ResponsesPage").then((module) => ({ default: module.ResponsesPage }))
);

type View = "dashboard" | "builder" | "analytics";

function publicSlug(pathname: string) {
  return pathname.match(/^\/f\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/)?.[1] ?? null;
}

function formIdFromPath(pathname: string) {
  return pathname.match(/^\/forms\/([a-f\d]{24})\/edit\/?$/i)?.[1] ?? null;
}

function analyticsFormIdFromPath(pathname: string) {
  return pathname.match(/^\/analytics\/([a-f\d]{24})\/?$/i)?.[1] ?? null;
}

function viewFromPath(pathname: string): View {
  if (pathname.startsWith("/analytics")) return "analytics";
  if (formIdFromPath(pathname)) return "builder";
  return "dashboard";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

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
            className={view === "analytics" ? "nav-item active button-reset" : "nav-item button-reset"}
            type="button"
            onClick={() => onNavigate("analytics")}
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
  const [pathname, setPathname] = useState(window.location.pathname);
  const activePublicSlug = publicSlug(pathname);
  const guestRoute = pathname === "/build/new" || pathname === "/build/new/";
  const loginRoute = pathname === "/login" || pathname === "/login/";
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(
    activePublicSlug === null && !guestRoute && !loginRoute && pathname !== "/"
  );
  const [view, setView] = useState<View>(() => viewFromPath(window.location.pathname));
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingFormAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<FormSummary | null>(null);
  const [analyticsForm, setAnalyticsForm] = useState<FormSummary | null>(null);

  function navigate(path: string, replace = false) {
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    setPathname(new URL(path, window.location.origin).pathname);
  }

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    setView(viewFromPath(pathname));
  }, [pathname]);

  useEffect(() => {
    if (activePublicSlug) return;
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, [activePublicSlug]);

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

  useEffect(() => {
    const requestedFormId = formIdFromPath(pathname);
    if (!user || !requestedFormId || activeForm?.id === requestedFormId) return;
    api
      .getForm(requestedFormId)
      .then(setActiveForm)
      .catch((caughtError) => {
        setError(errorMessage(caughtError, "The selected form could not be loaded."));
        navigate("/dashboard", true);
      });
  }, [activeForm?.id, pathname, user]);

  useEffect(() => {
    const requestedFormId = analyticsFormIdFromPath(pathname);
    if (!user || !requestedFormId || analyticsForm?.id === requestedFormId) return;
    api
      .getForm(requestedFormId)
      .then(setAnalyticsForm)
      .catch((caughtError) => {
        setError(errorMessage(caughtError, "The selected form could not be loaded."));
        navigate("/analytics", true);
      });
  }, [analyticsForm?.id, pathname, user]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const form = await api.createForm({ title: "Untitled form" });
      setForms((current) => [form, ...current]);
      setActiveForm(form);
      setView("builder");
      navigate(`/forms/${form.id}/edit`);
    } catch (caughtError) {
      setError(errorMessage(caughtError, "The form could not be created."));
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(form: FormSummary) {
    setPendingAction({ formId: form.id, action: "duplicate" });
    setError(null);
    setNotice(null);
    try {
      const duplicate = await api.duplicateForm(form.id);
      setForms((current) => [duplicate, ...current]);
      setNotice(`Duplicated “${form.title}” as “${duplicate.title}”.`);
    } catch (caughtError) {
      setError(errorMessage(caughtError, "The form could not be duplicated."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRename(form: FormSummary, title: string) {
    setPendingAction({ formId: form.id, action: "rename" });
    setError(null);
    setNotice(null);
    try {
      const renamed = await api.updateForm(form.id, { title });
      setForms((current) =>
        current.map((candidate) => (candidate.id === renamed.id ? renamed : candidate))
      );
      setActiveForm((current) => (current?.id === renamed.id ? renamed : current));
      setAnalyticsForm((current) => (current?.id === renamed.id ? renamed : current));
      setNotice(`Renamed “${form.title}” to “${renamed.title}”.`);
    } catch (caughtError) {
      setError(errorMessage(caughtError, "The form could not be renamed."));
      throw caughtError;
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete(form: FormSummary) {
    setPendingAction({ formId: form.id, action: "delete" });
    setError(null);
    setNotice(null);
    try {
      await api.deleteForm(form.id);
      setForms((current) => current.filter((candidate) => candidate.id !== form.id));
      if (activeForm?.id === form.id) setActiveForm(null);
      if (analyticsForm?.id === form.id) setAnalyticsForm(null);
      setNotice(`Deleted “${form.title}”.`);
    } catch (caughtError) {
      setError(errorMessage(caughtError, "The form could not be deleted."));
      throw caughtError;
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCopyPublicLink(form: FormSummary) {
    if (!form.slug) return;
    setPendingAction({ formId: form.id, action: "copy-link" });
    setError(null);
    setNotice(null);
    try {
      const publicUrl = new URL(`/f/${form.slug}`, window.location.origin).toString();
      await navigator.clipboard.writeText(publicUrl);
      setNotice(`Copied the public link for “${form.title}”.`);
    } catch (caughtError) {
      setError(errorMessage(caughtError, "The public link could not be copied."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setActiveForm(null);
      setAnalyticsForm(null);
      setNotice(null);
      setView("dashboard");
      navigate("/build/new");
    }
  }

  function handleNavigate(nextView: View) {
    if (nextView === "analytics") {
      setAnalyticsForm(null);
      setView("analytics");
      navigate("/analytics");
      return;
    }

    if (nextView === "builder" && activeForm) {
      setView("builder");
      navigate(`/forms/${activeForm.id}/edit`);
      return;
    }

    setView("dashboard");
    navigate("/dashboard");
  }

  async function handleSelectAnalyticsForm(formId: string) {
    const loadedForm = forms.find((form) => form.id === formId);
    if (loadedForm) {
      setAnalyticsForm(loadedForm);
      navigate(`/analytics/${loadedForm.id}`);
      return;
    }

    try {
      const form = await api.getForm(formId);
      setAnalyticsForm(form);
      navigate(`/analytics/${form.id}`);
    } catch (caughtError) {
      setError(errorMessage(caughtError, "The selected form could not be loaded."));
      setView("dashboard");
    }
  }

  if (activePublicSlug) {
    return (
      <Suspense fallback={<AppLoading />}>
        <PublicFormPage slug={activePublicSlug} />
      </Suspense>
    );
  }

  if (guestRoute || (pathname === "/" && !user && !checkingSession)) {
    return (
      <Suspense fallback={<AppLoading />}>
        <GuestBuilderPage
          onSignIn={() => navigate("/login?returnTo=%2Fbuild%2Fnew")}
        />
      </Suspense>
    );
  }

  const authenticate = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    navigate(returnTo === "/build/new" ? returnTo : "/dashboard", true);
  };

  if (loginRoute) {
    return <AuthPage onAuthenticated={authenticate} />;
  }

  if (checkingSession) return <AppLoading />;
  if (!user) {
    return <AuthPage onAuthenticated={authenticate} />;
  }

  return (
    <AppShell
      view={view}
      user={user}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      {view === "builder" && !activeForm && formIdFromPath(pathname) ? (
        <AppLoading />
      ) : view === "dashboard" || (view === "builder" && !activeForm) ? (
        <DashboardPage
          user={user}
          forms={forms}
          loading={formsLoading}
          creating={creating}
          pendingAction={pendingAction}
          error={error}
          notice={notice}
          onCreate={handleCreate}
          onDuplicate={handleDuplicate}
          onRename={handleRename}
          onDelete={handleDelete}
          onCopyPublicLink={handleCopyPublicLink}
          onOpenPublished={(form) => {
            if (!form.slug) return;
            window.open(`/f/${form.slug}`, "_blank", "noopener,noreferrer");
          }}
          onViewResponses={(form) => {
            setAnalyticsForm(form);
            setView("analytics");
            navigate(`/analytics/${form.id}`);
          }}
          onOpen={(form) => {
            setActiveForm(form);
            setView("builder");
            navigate(`/forms/${form.id}/edit`);
          }}
        />
      ) : view === "builder" && activeForm ? (
        <Suspense fallback={<AppLoading />}>
          <BuilderPage
            mode="owned"
            formId={activeForm.id}
            onBack={() => {
              setView("dashboard");
              navigate("/dashboard");
            }}
            onOpenResponses={() => {
              setAnalyticsForm(activeForm);
              setView("analytics");
              navigate(`/analytics/${activeForm.id}`);
            }}
            onSaved={(savedForm) => {
              setActiveForm(savedForm);
              setAnalyticsForm((current) =>
                current?.id === savedForm.id ? savedForm : current
              );
              setForms((current) =>
                current.map((form) => (form.id === savedForm.id ? savedForm : form))
              );
            }}
          />
        </Suspense>
      ) : analyticsForm ? (
        <Suspense fallback={<AppLoading />}>
          <ResponsesPage
            form={analyticsForm}
            onBack={() => {
              setAnalyticsForm(null);
              navigate("/analytics");
            }}
            onEdit={() => {
              setActiveForm(analyticsForm);
              setView("builder");
              navigate(`/forms/${analyticsForm.id}/edit`);
            }}
          />
        </Suspense>
      ) : (
        <AnalyticsOverviewPage
          onSelectForm={(formId) => void handleSelectAnalyticsForm(formId)}
        />
      )}
    </AppShell>
  );
}
