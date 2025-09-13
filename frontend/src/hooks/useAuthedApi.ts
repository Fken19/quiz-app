"use client";
import { useSession } from "next-auth/react";
import { NotAuthenticatedError } from "@/lib/api";

export function useAuthedApi() {
  const { data: session, status, update } = useSession();
  const getTokenFromSession = (s: unknown) => (s as any)?.backendAccessToken as string | undefined;

  const ensureToken = async (): Promise<string> => {
    // try current session first
    const current = getTokenFromSession(session);
    if (current) return current;

    // if session doesn't have token, attempt to refresh/reauthorize via update()
    try {
      const refreshed = await update();
      const refreshedToken = getTokenFromSession(refreshed);
      if (refreshedToken) return refreshedToken;
      console.debug('[useAuthedApi] update() completed but no backendAccessToken found', { status, refreshed });
    } catch (e) {
      console.error('[useAuthedApi] update() failed', e);
    }

    // give up
    throw new NotAuthenticatedError('backendAccessToken missing');
  };

  const fetcher = async (path: string, init?: RequestInit) => {
    const t = await ensureToken();
    // @ts-ignore
    return (await import("@/lib/api")).apiFetch(path, init, t);
  };

  const ready = status === "authenticated" && !!getTokenFromSession(session);
  return { fetcher, ready, status };
}
