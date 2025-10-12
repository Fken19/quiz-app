import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role?: string
    } & DefaultSession["user"]
    backendAccessToken?: string
    backendError?: string
  }
  
  interface User {
    id: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    userId?: string
    role?: string
    backendAccessToken?: string
    backendExpiresAt?: number
    backendError?: string
    denied?: boolean
  }
}
