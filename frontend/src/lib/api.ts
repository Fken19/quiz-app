
import { getSession } from "next-auth/react"
import { Session } from "next-auth"

// サーバー/クライアントでAPIエンドポイントを自動切り替え
const isServer = typeof window === "undefined";
const API_URL = isServer
  ? process.env.NEXT_PUBLIC_API_URL || "http://backend:8080"
  : process.env.NEXT_PUBLIC_API_URL_BROWSER || "http://localhost:8080";

// Bearer Token方式のAPIラッパー
export async function apiGet(path: string) {
  const session = await getSession()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if ((session as Session & { backendAccessToken?: string })?.backendAccessToken) {
    headers.Authorization = `Bearer ${(session as Session & { backendAccessToken?: string }).backendAccessToken}`
  }
  const res = await fetch(`${API_URL}${path}`, { headers })
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = '/auth/signin';
    }
    throw new Error(`${res.status} ${await res.text()}`)
  }
  return res.json()
}

export async function apiPost(path: string, body?: unknown) {
  const session = await getSession()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if ((session as Session & { backendAccessToken?: string })?.backendAccessToken) {
    headers.Authorization = `Bearer ${(session as Session & { backendAccessToken?: string }).backendAccessToken}`
  }
  const res = await fetch(`${API_URL}${path}`, { 
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = '/auth/signin';
    }
    throw new Error(`${res.status} ${await res.text()}`)
  }
  return res.json()
}

export async function apiPatch(path: string, body?: unknown) {
  const session = await getSession()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if ((session as Session & { backendAccessToken?: string })?.backendAccessToken) {
    headers.Authorization = `Bearer ${(session as Session & { backendAccessToken?: string }).backendAccessToken}`
  }
  const res = await fetch(`${API_URL}${path}`, { 
    method: "PATCH",
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = '/auth/signin';
    }
    throw new Error(`${res.status} ${await res.text()}`)
  }
  return res.json()
}

export async function apiPut(path: string, body?: unknown) {
  const session = await getSession()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if ((session as Session & { backendAccessToken?: string })?.backendAccessToken) {
    headers.Authorization = `Bearer ${(session as Session & { backendAccessToken?: string }).backendAccessToken}`
  }
  const res = await fetch(`${API_URL}${path}`, { 
    method: "PUT",
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = '/auth/signin';
    }
    throw new Error(`${res.status} ${await res.text()}`)
  }
  return res.json()
}

export async function apiDelete(path: string) {
  const session = await getSession()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if ((session as Session & { backendAccessToken?: string })?.backendAccessToken) {
    headers.Authorization = `Bearer ${(session as Session & { backendAccessToken?: string }).backendAccessToken}`
  }
  const res = await fetch(`${API_URL}${path}`, { 
    method: "DELETE",
    headers
  })
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = '/auth/signin';
    }
    throw new Error(`${res.status} ${await res.text()}`)
  }
  return res.json()
}



// 必要ならaxiosクライアントも同様にAPI_URLで生成すること

// apiClientのダミー実装（本来はaxios等で作成するが、ここではfetchラッパーを使う）
const apiClient = {
  get: apiGet,
  post: apiPost,
  patch: apiPatch,
  put: apiPut,
  delete: apiDelete,
};

export default apiClient;
