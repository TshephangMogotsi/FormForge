export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type FormFieldType = "shortText" | "longText" | "number" | "select" | "checkbox";

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  description: string;
  placeholder: string;
  required: boolean;
  options: string[];
};

export type FormSummary = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  fields: FormField[];
  status: "draft" | "published";
  slug: string | null;
  publishedVersion: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublishedForm = {
  formId: string;
  slug: string;
  version: number;
  title: string;
  description: string;
  fields: FormField[];
  publishedAt: string;
};

export type SubmissionAnswer = {
  fieldId: string;
  value: string | number | boolean;
};

export type StoredSubmission = {
  id: string;
  formId: string;
  formVersion: number;
  answers: SubmissionAnswer[];
  createdAt: string;
};

export type SubmissionAnalytics = {
  totalResponses: number;
  last7DaysResponses: number;
  trend: Array<{ date: string; count: number }>;
  distributions: Array<{
    fieldId: string;
    label: string;
    answered: number;
    options: Array<{ value: string; count: number; percentage: number }>;
  }>;
};

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    details?: Array<{ fieldId?: string; path?: string; message?: string }>;
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "UNKNOWN_ERROR",
    public readonly requestId?: string,
    public readonly details?: Array<{ fieldId?: string; path?: string; message?: string }>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers
    }
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json()) as T & ApiErrorBody;
  if (!response.ok) {
    throw new ApiError(
      body.error?.message ?? "The request could not be completed.",
      response.status,
      body.error?.code,
      body.error?.requestId,
      body.error?.details
    );
  }

  return body;
}

export const api = {
  async register(input: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) {
    const response = await apiRequest<{ data: { user: User } }>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return response.data.user;
  },

  async login(input: { email: string; password: string }) {
    const response = await apiRequest<{ data: { user: User } }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return response.data.user;
  },

  async forgotPassword(email: string) {
    const response = await apiRequest<{ data: { message: string } }>(
      "/api/v1/auth/forgot-password",
      {
        method: "POST",
        body: JSON.stringify({ email })
      }
    );
    return response.data.message;
  },

  resetPassword(input: { token: string; password: string; confirmPassword: string }) {
    return apiRequest<void>("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  async me() {
    const response = await apiRequest<{ data: { user: User } }>("/api/v1/auth/me");
    return response.data.user;
  },

  logout() {
    return apiRequest<void>("/api/v1/auth/logout", { method: "POST" });
  },

  async listForms() {
    const response = await apiRequest<{
      data: {
        forms: FormSummary[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }>("/api/v1/forms");
    return response.data;
  },

  async createForm(input: { title: string; description?: string }) {
    const response = await apiRequest<{ data: { form: FormSummary } }>("/api/v1/forms", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return response.data.form;
  },

  async duplicateForm(formId: string) {
    const response = await apiRequest<{ data: { form: FormSummary } }>(
      `/api/v1/forms/${formId}/duplicate`,
      { method: "POST" }
    );
    return response.data.form;
  },

  async getForm(formId: string) {
    const response = await apiRequest<{ data: { form: FormSummary } }>(
      `/api/v1/forms/${formId}`
    );
    return response.data.form;
  },

  async updateForm(
    formId: string,
    input: Partial<Pick<FormSummary, "title" | "description" | "fields">>
  ) {
    const response = await apiRequest<{ data: { form: FormSummary } }>(
      `/api/v1/forms/${formId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input)
      }
    );
    return response.data.form;
  },

  async publishForm(formId: string) {
    const response = await apiRequest<{
      data: { form: FormSummary; publication: PublishedForm };
    }>(`/api/v1/forms/${formId}/publish`, { method: "POST" });
    return response.data;
  },

  async getPublicForm(slug: string) {
    const response = await apiRequest<{ data: { form: PublishedForm } }>(
      `/api/v1/public/forms/${encodeURIComponent(slug)}`
    );
    return response.data.form;
  },

  async submitPublicForm(slug: string, answers: SubmissionAnswer[]) {
    const response = await apiRequest<{
      data: {
        submission: { id: string; formVersion: number; submittedAt: string };
      };
    }>(`/api/v1/public/forms/${encodeURIComponent(slug)}/submissions`, {
      method: "POST",
      body: JSON.stringify({ answers })
    });
    return response.data.submission;
  },

  async listSubmissions(formId: string, page = 1, limit = 10) {
    const response = await apiRequest<{
      data: {
        submissions: StoredSubmission[];
        versions: Array<{ version: number; fields: FormField[]; publishedAt: string }>;
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }>(`/api/v1/forms/${formId}/submissions?page=${page}&limit=${limit}`);
    return response.data;
  },

  async getFormAnalytics(formId: string) {
    const response = await apiRequest<{ data: { analytics: SubmissionAnalytics } }>(
      `/api/v1/forms/${formId}/analytics`
    );
    return response.data.analytics;
  }
};
