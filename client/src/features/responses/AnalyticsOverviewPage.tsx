import { useEffect, useState } from "react";
import { BarChart3, ChevronRight, FileText, Inbox, LoaderCircle } from "lucide-react";
import { api, type WorkspaceAnalytics } from "../../lib/api";
import { TrendChart } from "./TrendChart";

export function AnalyticsOverviewPage({
  onSelectForm
}: {
  onSelectForm: (formId: string) => void;
}) {
  const [analytics, setAnalytics] = useState<WorkspaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    api
      .getWorkspaceAnalytics()
      .then((loadedAnalytics) => {
        if (!ignore) setAnalytics(loadedAnalytics);
      })
      .catch((caughtError) => {
        if (!ignore) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Workspace analytics could not be loaded."
          );
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (loading && !analytics) {
    return (
      <div className="responses-state">
        <LoaderCircle className="spin" size={22} /> Loading workspace analytics…
      </div>
    );
  }

  return (
    <div className="responses-page analytics-overview-page">
      <header className="responses-header analytics-overview-header">
        <div>
          <span className="eyebrow">Workspace analytics</span>
          <h1>All forms</h1>
          <p>See response activity across your workspace, then open any form for details.</p>
        </div>
        {analytics?.forms.length ? (
          <label className="analytics-form-picker">
            View a form
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) onSelectForm(event.target.value);
              }}
            >
              <option value="">Choose a form…</option>
              {analytics.forms.map((form) => (
                <option key={form.formId} value={form.formId}>
                  {form.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      {analytics && (
        <>
          <section className="overview-metrics" aria-label="Workspace response summary">
            <article>
              <span>Total forms</span>
              <strong>{analytics.totalForms}</strong>
            </article>
            <article>
              <span>Published forms</span>
              <strong>{analytics.publishedForms}</strong>
            </article>
            <article>
              <span>Total responses</span>
              <strong>{analytics.totalResponses}</strong>
            </article>
            <article>
              <span>Last 7 days</span>
              <strong>{analytics.last7DaysResponses}</strong>
            </article>
          </section>

          <section className="analytics-overview-grid">
            <article className="analytics-card overview-trend-card">
              <div className="analytics-heading">
                <span>
                  <BarChart3 size={17} /> Response trend
                </span>
                <small>All forms · last 7 days</small>
              </div>
              <TrendChart
                trend={analytics.trend}
                label="Responses received across all forms over the last seven days"
              />
            </article>

            <article className="analytics-card analytics-form-performance">
              <div className="analytics-heading">
                <span>
                  <FileText size={17} /> Form performance
                </span>
                <small>{analytics.forms.length} forms</small>
              </div>
              {analytics.forms.length ? (
                <div className="analytics-form-rows">
                  {analytics.forms.map((form) => (
                    <button
                      className="analytics-form-row"
                      type="button"
                      key={form.formId}
                      onClick={() => onSelectForm(form.formId)}
                    >
                      <span className="analytics-form-name">
                        <strong>{form.title}</strong>
                        <small>
                          {form.totalResponses} total · {form.last7DaysResponses} this week
                        </small>
                      </span>
                      <span className={`status-pill ${form.status}`}>{form.status}</span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="analytics-overview-empty">
                  <Inbox size={24} />
                  <strong>No forms yet</strong>
                  <span>Create and publish a form to start building your analytics view.</span>
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  );
}
