import { getSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import { API_BASE_URL } from './constants';

// In-memory caches
let cachedSession: Session | null = null;
let cachedSessionAt = 0;
const SESSION_TTL_MS = 60_000; // 60s: safe and keeps getSession network calls rare

let cachedBackendToken: string | null = null;
let cachedBackendTokenAt = 0;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1h default; adjust to your backend token expiry

// Toggle for localStorage persistence (off by default for safety). Turn on if desired.
const USE_LOCAL_STORAGE = true;
const LS_TOKEN_KEY = 'quizapp.backend.token';
const LS_TOKEN_SAVED_AT = 'quizapp.backend.token.savedAt';

function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

function devLog(...args: any[]) {
  try { console.log('[auth-client]', ...args); } catch { /* noop */ }
}

export async function getCachedSession(force = false): Promise<Session | null> {
  const t0 = now();
  if (!force && cachedSession && (Date.now() - cachedSessionAt) < SESSION_TTL_MS) {
    return cachedSession;
  }
  const tStart = now();
  const s = await getSession();
  const tEnd = now();
  devLog('getSession', Math.round(tEnd - tStart), 'ms');
  cachedSession = s;
  cachedSessionAt = Date.now();
  return s;
}

function readTokenFromLocalStorage(): string | null {
  if (!USE_LOCAL_STORAGE) return null;
  try {
    const token = window.localStorage.getItem(LS_TOKEN_KEY);
    const savedAtStr = window.localStorage.getItem(LS_TOKEN_SAVED_AT);
    if (!token || !savedAtStr) return null;
    const savedAt = Number(savedAtStr);
    if (!Number.isFinite(savedAt)) return null;
    if ((Date.now() - savedAt) > TOKEN_TTL_MS) return null;
    return token;
  } catch { return null; }
}

function writeTokenToLocalStorage(token: string) {
  if (!USE_LOCAL_STORAGE) return;
  try {
    window.localStorage.setItem(LS_TOKEN_KEY, token);
    window.localStorage.setItem(LS_TOKEN_SAVED_AT, String(Date.now()));
  } catch { /* ignore storage errors */ }
}

export async function getBackendToken(): Promise<string> {
  // In-memory valid token
  if (cachedBackendToken && (Date.now() - cachedBackendTokenAt) < TOKEN_TTL_MS) {
    return cachedBackendToken;
  }
  // LocalStorage token (optional)
  const lsToken = readTokenFromLocalStorage();
  if (lsToken) {
    cachedBackendToken = lsToken;
    cachedBackendTokenAt = Date.now();
    return lsToken;
  }

  // Need to create/fetch a token via backend
  const session = await getCachedSession();
  if (!session?.user?.email) {
    throw new Error('認証が必要です');
  }

  const payload = {
    email: session.user.email,
    name: session.user.name || ''
  };

  const tStart = now();
  const res = await fetch(`${API_BASE_URL}/debug/create-user/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const tEnd = now();
  devLog('token-fetch', Math.round(tEnd - tStart), 'ms');

  if (!res.ok) {
    throw new Error('Django認証に失敗しました');
  }
  const data = await res.json();
  const token = data.access_token as string;
  cachedBackendToken = token;
  cachedBackendTokenAt = Date.now();
  writeTokenToLocalStorage(token);
  return token;
}
