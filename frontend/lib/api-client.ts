export class ApiError extends Error {
  readonly errors?: Record<string, string>;
  readonly status: number;

  constructor(message: string, errors?: Record<string, string>, status = 500) {
    super(message);
    this.name = "ApiError";
    this.errors = errors;
    this.status = status;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options;
  const url = new URL(path.replace(/^\//, ""), API_BASE || "http://localhost/");
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url.toString(), {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...headers },
    ...rest,
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new ApiError(body.message ?? "Có lỗi xảy ra", body.errors, res.status);
  }
  return body.data as T;
}
