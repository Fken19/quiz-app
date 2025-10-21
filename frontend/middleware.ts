import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const studentDomain = process.env.NEXT_PUBLIC_STUDENT_DOMAIN?.toLowerCase();
const teacherDomain = process.env.NEXT_PUBLIC_TEACHER_DOMAIN?.toLowerCase();

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase();
  const url = request.nextUrl.clone();

  if (teacherDomain && host === teacherDomain) {
    if (!url.pathname.startsWith('/teacher') && !url.pathname.startsWith('/api')) {
      url.pathname = `/teacher${url.pathname}`.replace(/\/+$/, '');
      return NextResponse.rewrite(url);
    }
  } else if (studentDomain && host === studentDomain) {
    if (!url.pathname.startsWith('/student') && !url.pathname.startsWith('/api')) {
      url.pathname = `/student${url.pathname}`.replace(/\/+$/, '');
      return NextResponse.rewrite(url);
    }
  }

  if (url.pathname.startsWith('/teacher')) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL('/auth/signin', request.url);
      loginUrl.searchParams.set('callbackUrl', url.pathname);
      return NextResponse.redirect(loginUrl);
    }
    const role = (token.role as string | undefined) ?? '';
    if (role && role !== 'teacher' && role !== 'admin') {
      return NextResponse.redirect(new URL('/teacher/access-denied', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
