
import { getSession } from "next-auth/react"

// サーバー/クライアントでAPIエンドポイントを自動切り替え
const isServer = typeof window === "undefined";
const API_URL = isServer
  ? process.env.NEXT_PUBLIC_API_URL || "http://backend:8080"
  : process.env.NEXT_PUBLIC_API_URL_BROWSER || "http://localhost:8080";

// Bearer Token方式のAPIラッパー
export async function apiGet(path: string) {
  const session = await getSession()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if ((session as any)?.backendAccessToken) {
    headers.Authorization = `Bearer ${(session as any).backendAccessToken}`
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

export async function apiPost(path: string, body?: any) {
  const session = await getSession()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if ((session as any)?.backendAccessToken) {
    headers.Authorization = `Bearer ${(session as any).backendAccessToken}`
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



// 必要ならaxiosクライアントも同様にAPI_URLで生成すること

// apiClientのダミー実装（本来はaxios等で作成するが、ここではfetchラッパーを使う）
const apiClient = {
  get: apiGet,
  post: apiPost,
  // patch, put, delete など必要に応じて追加
};

export default apiClient;
