import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  Pencil
} from "lucide-react";
import {
  api,
  type FormField,
  type FormSummary,
  type StoredSubmission,
  type SubmissionAnalytics
} from "../../lib/api";
import { TrendChart } from "./TrendChart";

type SubmissionData = Awaited<ReturnType<typeof api.listSubmissions>>;

function formatAnswer(value: string | number | boolean | undefined) {
  if (value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function ResponseTable({ data }: { data: SubmissionData }) {
  const columns = useMemo(() => {
    const fields = new Map<string, FormField>();
    [...data.versions]
      .sort((left, right) => right.version - left.version)
      .forEach((version) => version.fields.forEach((field) => {
        if (!fields.has(field.id)) fields.set(field.id, field);
      }));
    return [...fields.values()];
  }, [data.versions]);

  return (
    <div className="response-table-scroll">
      <table className="response-table">
        <thead>
          <tr>
            <th>Submitted</th>
            <th>Version</th>
            {columns.map((field) => <th key={field.id}>{field.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.submissions.map((submission: StoredSubmission) => {
            const answers = new Map(submission.answers.map((answer) => [answer.fieldId, answer.value]));
            return (
              <tr key={submission.id}>
                <td className="response-date">{formatDate(submission.createdAt)}</td>
                <td><span className="version-pill">v{submission.formVersion}</span></td>
                {columns.map((field) => (
                  <td key={field.id} title={formatAnswer(answers.get(field.id))}>
                    {formatAnswer(answers.get(field.id))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ResponsesPage({
  form,
  onBack,
  onEdit
}: {
  form: FormSummary;
  onBack: () => void;
  onEdit: () => void;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SubmissionData | null>(null);
  const [analytics, setAnalytics] = useState<SubmissionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    Promise.all([api.listSubmissions(form.id, page, 10), api.getFormAnalytics(form.id)])
      .then(([loadedData, loadedAnalytics]) => {
        if (ignore) return;
        setData(loadedData);
        setAnalytics(loadedAnalytics);
      })
      .catch((caughtError) => {
        if (!ignore) {
          setError(caughtError instanceof Error ? caughtError.message : "Responses could not be loaded.");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => { ignore = true; };
  }, [form.id, page]);

  if (loading && !data) {
    return <div className="responses-state"><LoaderCircle className="spin" size={22} /> Loading responses…</div>;
  }

  return (
    <div className="responses-page">
      <header className="responses-header">
        <div>
          <button className="responses-back button-reset" type="button" onClick={onBack}>
            <ArrowLeft size={16} /> All forms
          </button>
          <span className="eyebrow">Response workspace</span>
          <h1>{form.title}</h1>
          <p>Review validated responses and trends from the live form.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onEdit}>
          <Pencil size={16} /> Edit form
        </button>
      </header>

      {error && <div className="dashboard-error" role="alert">{error}</div>}

      {analytics && (
        <>
          <section className="response-metrics" aria-label="Response summary">
            <article><span>Total responses</span><strong>{analytics.totalResponses}</strong></article>
            <article><span>Last 7 days</span><strong>{analytics.last7DaysResponses}</strong></article>
            <article><span>Live version</span><strong>v{form.publishedVersion || 0}</strong></article>
          </section>

          <section className="analytics-grid">
            <article className="analytics-card trend-card">
              <div className="analytics-heading"><span><BarChart3 size={17} /> Response trend</span><small>Last 7 days</small></div>
              <TrendChart trend={analytics.trend} />
            </article>
            <article className="analytics-card distribution-card">
              <div className="analytics-heading"><span>Option distribution</span><small>Published dropdowns</small></div>
              {analytics.distributions.length ? analytics.distributions.map((distribution) => (
                <div className="distribution-block" key={distribution.fieldId}>
                  <strong>{distribution.label}</strong>
                  {distribution.options.map((option) => (
                    <div className="distribution-row" key={option.value}>
                      <span>{option.value}</span>
                      <div><i style={{ width: `${option.percentage}%` }} /></div>
                      <small>{option.count} · {option.percentage}%</small>
                    </div>
                  ))}
                </div>
              )) : <p className="analytics-empty">Add a dropdown field to see option distribution.</p>}
            </article>
          </section>
        </>
      )}

      <section className="response-list-section">
        <div className="response-list-heading">
          <div><h2>Responses</h2><p>Newest submissions appear first.</p></div>
          {data && <span>{data.pagination.total} total</span>}
        </div>
        {data?.submissions.length ? (
          <>
            <ResponseTable data={data} />
            <nav className="response-pagination" aria-label="Response pages">
              <button className="secondary-button" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
                <ChevronLeft size={16} /> Previous
              </button>
              <span>Page {data.pagination.page} of {Math.max(1, data.pagination.pages)}</span>
              <button className="secondary-button" type="button" disabled={page >= data.pagination.pages || loading} onClick={() => setPage((current) => current + 1)}>
                Next <ChevronRight size={16} />
              </button>
            </nav>
          </>
        ) : (
          <div className="responses-empty">
            <Inbox size={25} />
            <strong>No responses yet</strong>
            <span>Share the live form link to start collecting answers.</span>
          </div>
        )}
      </section>
    </div>
  );
}
