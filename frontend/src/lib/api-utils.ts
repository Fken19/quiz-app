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

// Teacher Group Management APIs
export const TeacherGroupsAPI = {
  list: () => apiGet('/teacher/groups/'),
  get: (id: string) => apiGet(`/teacher/groups/${id}/`),
  create: (name: string) => apiPost('/teacher/groups/', { name }),
  update: (id: string, name: string) => apiRequest(`/teacher/groups/${id}/`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  delete: (id: string) => apiDelete(`/teacher/groups/${id}/`),
  members: (id: string) => apiGet(`/teacher/groups/${id}/members/`),
  // with filters: { q?, attr1?, attr2?, order? }
  membersFiltered: (id: string, params: { q?: string; attr1?: string; attr2?: string; order?: 'created_at'|'name' } = {}) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set('q', params.q);
    if (params.attr1) usp.set('attr1', params.attr1);
    if (params.attr2) usp.set('attr2', params.attr2);
    if (params.order) usp.set('order', params.order);
    const qs = usp.toString();
    return apiGet(`/teacher/groups/${id}/members/${qs ? `?${qs}` : ''}`);
  },
  addMembersByIds: (id: string, studentIds: string[]) => apiPost(`/teacher/groups/${id}/add_members/`, { student_ids: studentIds }),
  searchCandidates: (id: string, params: { q?: string; status?: 'active'|'pending'|'all' } = {}) => apiPost(`/teacher/groups/${id}/add_members/`, params),
  removeMember: (groupId: string, memberId: string) => apiDelete(`/teacher/groups/${groupId}/remove-member/${memberId}/`),
  rankings: (id: string, params: { period: 'daily'|'weekly'|'monthly'; metric: 'answers'|'accuracy' }) => apiGet(`/teacher/groups/${id}/rankings/?period=${encodeURIComponent(params.period)}&metric=${encodeURIComponent(params.metric)}`),
  dashboard: (id: string, params: { days?: number; min_answers_for_accuracy?: number } = {}) => {
    const usp = new URLSearchParams();
    if (params.days != null) usp.set('days', String(params.days));
    if (params.min_answers_for_accuracy != null) usp.set('min_answers_for_accuracy', String(params.min_answers_for_accuracy));
    const qs = usp.toString();
    return apiGet(`/teacher/groups/${id}/dashboard/${qs ? `?${qs}` : ''}`);
  },
  updateMemberAttributes: (groupId: string, memberId: string, payload: { attr1?: string; attr2?: string }) => apiPost(`/teacher/groups/${groupId}/members/${memberId}/attributes/`, payload),
  assignTest: (groupId: string, payload: { title?: string; template_id?: string; timer_seconds?: number }) => apiPost(`/teacher/groups/${groupId}/assign_test/`, payload),
};

// Teacher Student Aliases API
export const TeacherAliasesAPI = {
  list: () => apiGet('/teacher/aliases/'),
  upsert: (studentId: string, aliasName: string, note?: string) => apiPost('/teacher/aliases/upsert/', { student_id: studentId, alias_name: aliasName, note }),
  delete: (studentId: string) => apiDelete(`/teacher/aliases/${studentId}/`),
};

// Teacher Student Detail (by student id)
export const TeacherStudentDetailAPI = {
  getByStudent: (studentId: string) => apiGet(`/teacher/student-detail/by-student/${studentId}/detail/`),
};

// Teacher Test Templates API
export const TeacherTestTemplatesAPI = {
  list: () => apiGet('/teacher/test-templates/'),
  get: (id: string) => apiGet(`/teacher/test-templates/${id}/`),
  create: (payload: { title: string; description?: string; default_timer_seconds?: number | null; items?: any[] }) =>
    apiPost('/teacher/test-templates/', payload),
  update: (id: string, payload: { title?: string; description?: string; default_timer_seconds?: number | null; items?: any[] }) =>
    apiRequest(`/teacher/test-templates/${id}/`, { method: 'PATCH', body: JSON.stringify(payload) }),
  delete: (id: string) => apiDelete(`/teacher/test-templates/${id}/`),
};
