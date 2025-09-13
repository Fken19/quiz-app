// API呼び出し用のユーティリティ関数
import { getSession } from 'next-auth/react';

const API_BASE_URL = 'http://localhost:8080/api';

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const session = await getSession();
  
  if (!session?.user?.email) {
    throw new Error('認証が必要です');
  }

  // DjangoでGoogle認証からアクセストークンを取得
  let token = (session as any)?.backendAccessToken;
  
  if (!token) {
    try {
      // Djangoのデバッグ用ユーザー作成エンドポイントを使ってトークンを取得
      const authResponse = await fetch(`${API_BASE_URL}/debug/create-user/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: session.user.email,
          name: session.user.name || ''
        }),
      });
      
      if (authResponse.ok) {
        const authData = await authResponse.json();
        token = authData.access_token;
        
        // セッションにトークンを保存（簡易的）
        (session as any).backendAccessToken = token;
      } else {
        throw new Error('Django認証に失敗しました');
      }
    } catch (error) {
      console.error('Django認証エラー:', error);
      throw new Error('認証に失敗しました');
    }
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
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
