import NextAuth, { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  callbacks: {
    // ① サインイン時（だけ）Django と握手してトークン等を受け取る
    async jwt({ token, account, trigger }) {
      if (trigger === "signIn") {
        console.log('[jwt] signIn trigger, provider=', account?.provider, 'has_id_token=', !!account?.id_token)
      }
      if (trigger === "signIn" && account?.provider === "google" && account.id_token) {
        try {
          const payload = { id_token: account.id_token }
          // サーバ側からの呼び出しは実行環境によって到達先が変わる（コンテナ内からは service 名、
          // ホスト上で動く dev サーバーからは localhost）。候補 URL を順に試して成功した最初のものを使う。
          const candidates = [] as string[];
          // 優先: 環境変数で明示された URL
          if (process.env.NEXT_PUBLIC_API_URL) candidates.push(process.env.NEXT_PUBLIC_API_URL);
          // ブラウザ向けに設定された URL（ローカル開発で localhost を指すことが多い）
          if (process.env.NEXT_PUBLIC_API_URL_BROWSER) candidates.push(process.env.NEXT_PUBLIC_API_URL_BROWSER);
          // 既知のデフォルト候補
          candidates.push('http://backend:8080');
          candidates.push('http://localhost:8080');

          let r: Response | null = null;
          let chosenBackendUrl: string | null = null;

          for (const base of candidates) {
            try {
              const url = `${base.replace(/\/+$/, '')}/api/auth/google/`;
              console.log('[jwt] trying handshake to backend candidate', { url, payloadSize: JSON.stringify(payload).length });
              const ctrl = new AbortController();
              const id = setTimeout(() => ctrl.abort(), 4000);
              r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: ctrl.signal,
              });
              clearTimeout(id);
              // 成功または400/403等を返しているならその URL を採用
              chosenBackendUrl = base;
              break;
            } catch (err) {
              console.warn('[jwt] handshake candidate failed, trying next', { candidate: base, error: String(err) });
              // 次の候補へ
              r = null;
              chosenBackendUrl = null;
            }
          }

          if (!r) throw new Error('All backend handshake candidates failed');
          console.log('[jwt] django handshake response candidate', { chosenBackendUrl });

          const text = await r.text().catch(() => '')
          let data: unknown = {}
          try { data = text ? JSON.parse(text) : {} } catch { data = text }
          console.log("[jwt] django handshake response", { status: r.status, body: data, rawTextSample: (typeof text === 'string' ? text.slice(0,1000) : '') })

          const handshakePayload = isHandshakeResponse(data) ? data : undefined;

          if (r.ok && handshakePayload) {
            // Django が返すアクセストークン/ロールを保存
            token.backendAccessToken = handshakePayload.access_token
            token.backendExpiresAt = Date.now() + (handshakePayload.expires_in ?? 3600) * 1000
            token.role = handshakePayload.role ?? "user"
            token.userId = handshakePayload.user?.id
          } else if (r.status === 403) {
            // 本当に禁止の場合のみフラグを立てる
            token.denied = true
          } else {
            // ネットワークや一時 5xx はログだけ（ログイン自体は通す）
            token.backendError = `handshake_failed_${r.status}`
            // 追加ログ保存
            console.warn('[jwt] handshake non-ok status', { status: r.status, body: data })
          }
        } catch (error) {
          console.error("[jwt] django fetch error", error)
          token.backendError = "handshake_exception"
        }
      }
      return token
    },

    // ② クライアントへ必要最小限を渡す
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string }).id = token.userId as string
        (session.user as { id?: string; role?: string }).role = token.role as string
      }
      (session as { backendAccessToken?: string }).backendAccessToken = token.backendAccessToken as string
      (session as { backendError?: string }).backendError = token.backendError as string
      return session
    },

    // ③ 基本は通す（明確な拒否条件のみfalseを返す）
    async signIn({ user, account }) {
      console.log("[signIn] HIT", { email: user?.email, provider: account?.provider })
      // ここで "絶対に拒否したい条件" だけ false を返す（例：メールドメイン制限）
      return true
    },
  },

  logger: { 
    error: (code, metadata) => console.error("[next-auth:error]", code, metadata),
    warn: (code) => console.warn("[next-auth:warn]", code),
    debug: (code, metadata) => console.log("[next-auth:debug]", code, metadata),
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }

type HandshakeResponse = {
  access_token?: string;
  expires_in?: number;
  role?: string;
  user?: { id?: string };
};

function isHandshakeResponse(value: unknown): value is HandshakeResponse {
  return typeof value === 'object' && value !== null;
}
