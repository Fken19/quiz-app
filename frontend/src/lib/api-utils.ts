import { getBackendToken } from './auth-client';

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const ensureApiPath = (endpoint: string): string => {
  if (/^https?:\/\//.test(endpoint)) return endpoint;
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return normalized.startsWith('/api/') ? normalized : `/api${normalized}`;
};

const resolveUrl = (endpoint: string): string => {
  const apiPath = ensureApiPath(endpoint);

  // Browser must always call Next.js same-origin API routes.
  if (typeof window !== 'undefined') {
    return apiPath;
  }

  // Server-side may use internal Docker network base.
  const internalBase = process.env.API_INTERNAL_BASE_URL;
  if (internalBase && !/^https?:\/\//.test(apiPath)) {
    return `${internalBase.replace(/\/$/, '')}${apiPath}`;
  }

  return apiPath;
};

const readBody = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  if (contentType.startsWith('text/')) {
    return response.text();
  }
  return null;
};

const extractErrorMessage = (body: unknown, fallback: string): string => {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === 'string') {
      return record.detail;
    }
    if (typeof record.error === 'string') {
      return record.error;
    }
  }
  return fallback;
};

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = await getBackendToken();
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(resolveUrl(endpoint), {
    ...options,
    credentials: 'include',
    headers: isFormData
      ? {
          ...(options.headers as Record<string, string> | undefined),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }
      : {
          ...headers,
          ...(options.headers as Record<string, string> | undefined),
        },
  });

  if (response.status === 204) {
    return null;
  }

  const body = await readBody(response);

  if (!response.ok) {
    const message = extractErrorMessage(body, response.statusText || `HTTP ${response.status}`);
    throw new ApiError(String(message), response.status, body);
  }

  return body;
}

export const apiGet = (endpoint: string) => apiRequest(endpoint);
export const apiPost = (endpoint: string, payload: unknown) =>
  apiRequest(endpoint, {
    method: 'POST',
    body: payload instanceof FormData ? payload : JSON.stringify(payload),
  });
export const apiPatch = (endpoint: string, payload: unknown) =>
  apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify(payload) });
export const apiDelete = (endpoint: string) => apiRequest(endpoint, { method: 'DELETE' });
