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
      if (trigger === "signIn" && account?.provider === "google" && account.id_token) {
        try {
          const ctrl = new AbortController()
          const id = setTimeout(() => ctrl.abort(), 4000)

          const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token: account.id_token }),
            signal: ctrl.signal,
          })
          clearTimeout(id)

          const data = await r.json().catch(() => ({}))
          console.log("[jwt] django handshake", r.status, data)

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
