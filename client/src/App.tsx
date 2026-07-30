import { useState } from "react";
import {
  BarChart3,
  Blocks,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Sparkles
} from "lucide-react";
import { BuilderPage } from "./features/builder/BuilderPage";

type View = "dashboard" | "builder";

function AppShell({
  children,
  view,
  onNavigate
}: {
  children: React.ReactNode;
  view: View;
  onNavigate: (view: View) => void;
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
            <span className="avatar">DN</span>
            <span className="profile-copy">
              <strong>Demo workspace</strong>
              <small>Starter account</small>
            </span>
            <LogOut size={16} />
          </div>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

function DashboardPage({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <span className="eyebrow">Your workspace</span>
          <h1>Good evening, Diginav.</h1>
          <p>Build something worth responding to.</p>
        </div>
        <button className="primary-button" type="button" onClick={onCreate}>
          <Plus size={18} />
          New form
        </button>
      </header>

      <section className="metric-grid" aria-label="Workspace overview">
        <article className="metric-card">
          <span className="metric-label">Total forms</span>
          <strong>0</strong>
          <small>Your first form starts here</small>
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
            <p>Your drafts and published forms will appear here.</p>
          </div>
        </div>

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
      </section>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <AppShell view={view} onNavigate={setView}>
      {view === "dashboard" ? (
        <DashboardPage onCreate={() => setView("builder")} />
      ) : (
        <BuilderPage onBack={() => setView("dashboard")} />
      )}
    </AppShell>
  );
}
