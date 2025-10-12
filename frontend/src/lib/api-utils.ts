import { API_BASE_URL } from './constants';
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
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
  apiRequest(endpoint, { method: 'POST', body: JSON.stringify(payload) });
export const apiPatch = (endpoint: string, payload: unknown) =>
  apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify(payload) });
export const apiDelete = (endpoint: string) => apiRequest(endpoint, { method: 'DELETE' });
