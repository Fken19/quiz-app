import NextAuth, { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const isProd = process.env.NODE_ENV === "production"

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
          // サーバ（この Next 実行プロセス）から呼ぶときはコンテナ内で名前解決できる
          // NEXT_PUBLIC_API_URL を優先し、開発時にブラウザから呼ぶ場合は
          // NEXT_PUBLIC_API_URL_BROWSER を使用する（存在しない場合は localhost をフォールバック）
          const backendUrl = (typeof window === 'undefined')
            ? (process.env.NEXT_PUBLIC_API_URL || 'http://backend:8080')
            : (process.env.NEXT_PUBLIC_API_URL_BROWSER || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080')
          console.log('[jwt] sending handshake to backend', { url: backendUrl + '/api/auth/google/', payloadSize: JSON.stringify(payload).length, chosenBackendUrl: backendUrl })

          const ctrl = new AbortController()
          const id = setTimeout(() => ctrl.abort(), 4000)

          const r = await fetch(`${backendUrl}/api/auth/google/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: ctrl.signal,
          })
          clearTimeout(id)

          const text = await r.text().catch(() => '')
          let data: any = {}
          try { data = text ? JSON.parse(text) : {} } catch (e) { data = { raw: text } }
          console.log("[jwt] django handshake response", { status: r.status, body: data, rawTextSample: (typeof text === 'string' ? text.slice(0,1000) : '') })

          if (r.ok) {
            // Django が返すアクセストークン/ロールを保存
            token.backendAccessToken = data.access_token
            token.backendExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000
            token.role = data.role ?? "user"
            token.userId = data.user?.id
          } else if (r.status === 403) {
            // 本当に禁止の場合のみフラグを立てる
            token.denied = true
          } else {
            // ネットワークや一時 5xx はログだけ（ログイン自体は通す）
            token.backendError = `handshake_failed_${r.status}`
            // 追加ログ保存
            console.warn('[jwt] handshake non-ok status', { status: r.status, body: data })
          }
        } catch (e) {
          console.error("[jwt] django fetch error", e)
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
