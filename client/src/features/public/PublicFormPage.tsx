import { useEffect, useState } from "react";
import { Blocks, CheckCircle2, LoaderCircle } from "lucide-react";
import {
  ApiError,
  api,
  type FormField,
  type PublishedForm,
  type SubmissionAnswer
} from "../../lib/api";

type AnswerState = Record<string, string | boolean>;
type FieldErrors = Record<string, string>;

function buildSubmission(
  fields: FormField[],
  values: AnswerState
): { answers: SubmissionAnswer[]; errors: FieldErrors } {
  const answers: SubmissionAnswer[] = [];
  const errors: FieldErrors = {};

  for (const field of fields) {
    const value = values[field.id];

    if (field.type === "checkbox") {
      const checked = value === true;
      if (field.required && !checked) {
        errors[field.id] = "This confirmation is required.";
      } else if (checked) {
        answers.push({ fieldId: field.id, value: true });
      }
      continue;
    }

    const textValue = typeof value === "string" ? value.trim() : "";
    if (!textValue) {
      if (field.required) errors[field.id] = "This field is required.";
      continue;
    }

    if (field.type === "number") {
      const numericValue = Number(textValue);
      if (!Number.isFinite(numericValue)) {
        errors[field.id] = "Enter a valid number.";
      } else {
        answers.push({ fieldId: field.id, value: numericValue });
      }
      continue;
    }

    if (field.type === "select" && !field.options.includes(textValue)) {
      errors[field.id] = "Choose one of the available options.";
      continue;
    }

    answers.push({ fieldId: field.id, value: textValue });
  }

  return { answers, errors };
}

function PublicField({
  field,
  value,
  error,
  onChange
}: {
  field: FormField;
  value: string | boolean | undefined;
  error?: string;
  onChange: (value: string | boolean) => void;
}) {
  const inputId = `public-${field.id}`;
  const descriptionId = field.description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`public-field${error ? " has-error" : ""}`}>
      <label htmlFor={inputId}>
        {field.label}
        {field.required && <span className="required-mark"> *</span>}
      </label>
      {field.description && (
        <small id={descriptionId} className="public-field-description">
          {field.description}
        </small>
      )}

      {field.type === "longText" ? (
        <textarea
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          maxLength={5000}
          placeholder={field.placeholder}
          rows={4}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === "select" ? (
        <select
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{field.placeholder || "Choose an option"}</option>
          {field.options.map((option, index) => (
            <option value={option} key={`${option}-${index}`}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "checkbox" ? (
        <span className="public-checkbox">
          <input
            id={inputId}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            checked={value === true}
            type="checkbox"
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>Yes, I agree</span>
        </span>
      ) : (
        <input
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          inputMode={field.type === "number" ? "decimal" : undefined}
          maxLength={field.type === "shortText" ? 5000 : undefined}
          placeholder={field.placeholder}
          type={field.type === "number" ? "number" : "text"}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {error && (
        <small className="public-field-error" id={errorId} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export function PublicFormPage({ slug }: { slug: string }) {
  const [form, setForm] = useState<PublishedForm | null>(null);
  const [values, setValues] = useState<AnswerState>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let ignore = false;
    api
      .getPublicForm(slug)
      .then((loadedForm) => {
        if (!ignore) setForm(loadedForm);
      })
      .catch((error) => {
        if (!ignore) {
          setLoadError(error instanceof Error ? error.message : "This form could not be loaded.");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [slug]);

  function focusFirstError(fieldErrors: FieldErrors) {
    const firstFieldId = form?.fields.find((field) => fieldErrors[field.id])?.id;
    if (firstFieldId) {
      window.setTimeout(() => document.getElementById(`public-${firstFieldId}`)?.focus(), 0);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form || submitting) return;

    const submission = buildSubmission(form.fields, values);
    setErrors(submission.errors);
    setSubmitError(null);
    if (Object.keys(submission.errors).length) {
      focusFirstError(submission.errors);
      return;
    }

    setSubmitting(true);
    try {
      await api.submitPublicForm(form.slug, submission.answers);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (error instanceof ApiError && error.code === "INVALID_SUBMISSION") {
        const fieldErrors = Object.fromEntries(
          (error.details ?? [])
            .filter((detail) => detail.fieldId && detail.message)
            .map((detail) => [detail.fieldId!, detail.message!])
        );
        setErrors(fieldErrors);
        focusFirstError(fieldErrors);
      }
      setSubmitError(error instanceof Error ? error.message : "Your response could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="public-form-state" aria-live="polite">
        <LoaderCircle className="spin" size={22} /> Loading form…
      </main>
    );
  }

  if (!form || loadError) {
    return (
      <main className="public-form-state" role="alert">
        <span className="public-brand-mark"><Blocks size={21} /></span>
        <h1>Form unavailable</h1>
        <p>{loadError ?? "This form is not available."}</p>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="public-form-page">
        <section className="public-success" aria-live="polite">
          <span className="success-icon"><CheckCircle2 size={28} /></span>
          <h1>Response received</h1>
          <p>Thanks—your response has been securely recorded.</p>
          <span className="public-powered"><Blocks size={15} /> Powered by FormForge</span>
        </section>
      </main>
    );
  }

  return (
    <main className="public-form-page">
      <form className="public-form-card" noValidate onSubmit={handleSubmit}>
        <header className="public-form-header">
          <span className="form-kicker">Form</span>
          <h1>{form.title}</h1>
          {form.description && <p>{form.description}</p>}
        </header>

        <div className="public-field-list">
          {form.fields.map((field) => (
            <PublicField
              key={field.id}
              field={field}
              value={values[field.id]}
              error={errors[field.id]}
              onChange={(value) => {
                setValues((current) => ({ ...current, [field.id]: value }));
                setErrors((current) => {
                  if (!current[field.id]) return current;
                  const next = { ...current };
                  delete next[field.id];
                  return next;
                });
              }}
            />
          ))}
        </div>

        {submitError && <div className="public-submit-error" role="alert">{submitError}</div>}

        <button className="primary-button public-submit" type="submit" disabled={submitting}>
          {submitting && <LoaderCircle className="spin" size={18} />}
          {submitting ? "Submitting…" : "Submit response"}
        </button>
        <span className="public-powered"><Blocks size={15} /> Powered by FormForge</span>
      </form>
    </main>
  );
}
