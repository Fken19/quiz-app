import NextAuth from "next-auth/middleware";

export default NextAuth;

export const config = {
  // middleware 一時無効化のためリネーム（_middleware.ts.bak へ）
  matcher: [
    // api/auth, auth, _next, 画像などは除外
    "/((?!api/auth|auth|_next/static|_next/image|favicon.ico|images|$).*)",
  ],
};
