// API呼び出し用のユーティリティ関数
import { API_BASE_URL } from './constants';
import { getBackendToken } from './auth-client';

export class ApiError extends Error {
  status: number;
  body?: any;
  constructor(message: string, status: number, body?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const devLog = (...args: any[]) => {
    try {
      // eslint-disable-next-line no-console
      console.log('[timing-api]', ...args);
    } catch (_) {}
  };

  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // Obtain backend token from shared auth-client (uses memo + optional localStorage).
  const token = await getBackendToken();

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // actual API request timing
  const tFetchStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });
  } catch (err: any) {
    // ネットワークや CORS エラーなど
    throw new Error(`Network error calling ${endpoint}: ${err?.message || String(err)}`);
  }
  const tFetchEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  devLog('request-fetch', Math.round(tFetchEnd - tFetchStart), 'ms', endpoint);

  const tTotal = Math.round(( (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - t0 ));
  devLog('request-total', tTotal, 'ms', endpoint);

  // 204 No Content を安全に処理
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    // JSON のときは JSON を試みて、失敗したらテキストを読む
    if (contentType.includes('application/json')) {
      const errorBody = await response.json().catch(() => null);
      const message =
        errorBody?.error || errorBody?.message || (errorBody ? JSON.stringify(errorBody) : undefined) ||
        `HTTP ${response.status} ${response.statusText}`;
      throw new ApiError(`API ${endpoint} error: ${message}`, response.status, errorBody || undefined);
    }

    // JSON 以外（HTML など）の場合はテキストで取得して要約を返す
    const text = await response.text().catch(() => '');
    const short = text ? (text.length > 200 ? text.slice(0, 200) + '...' : text) : `${response.status} ${response.statusText}`;
    throw new ApiError(`API ${endpoint} error: HTTP ${response.status} ${response.statusText}: ${short}`, response.status, { text });
  }

  // 成功時のレスポンスも content-type を見て JSON またはテキストを返す
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export async function apiPost(endpoint: string, data: any) {
  return apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiDelete(endpoint: string) {
  return apiRequest(endpoint, {
    method: 'DELETE',
  });
}

export async function apiGet(endpoint: string) {
  return apiRequest(endpoint);
}
