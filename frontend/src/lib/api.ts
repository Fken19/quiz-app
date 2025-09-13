

'use client';


export class NotAuthenticatedError extends Error {}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  token?: string
) {
  const headers = new Headers(init.headers ?? {});
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    throw new NotAuthenticatedError('backendAccessToken missing');
  }
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL_BROWSER || "http://localhost:8080"}${path}`,
    { ...init, headers, cache: 'no-store', credentials: 'omit' }
  );
  return res;
}


export async function apiPut(path: string, body?: unknown) {
  return apiFetch(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined
  }).then(res => res.json());
}


export async function apiDelete(path: string) {
  return apiFetch(path, {
    method: 'DELETE',
  }).then(res => res.json());
}



// 必要ならaxiosクライアントも同様にAPI_URLで生成すること


// apiFetchのみをエクスポート
export default apiFetch;
