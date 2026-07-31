export type User = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export type FormSummary = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
};

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "UNKNOWN_ERROR",
    public readonly requestId?: string
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
      body.error?.requestId
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
  }
};
