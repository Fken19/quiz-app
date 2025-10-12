'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import TeacherNavigation from './TeacherNavigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { apiGet } from '@/lib/api-utils';
import type { ApiUser } from '@/types/quiz';

interface TeacherShellProps {
  children: React.ReactNode;
}

export default function TeacherShell({ children }: TeacherShellProps) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const PUBLIC_PATHS = new Set(['/teacher', '/teacher/top', '/teacher/login', '/teacher/access-denied']);
  const isPublicPath = pathname ? PUBLIC_PATHS.has(pathname) : false;

  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(!isPublicPath);

  useEffect(() => {
    if (isPublicPath) {
      setLoading(false);
      return;
    }

    const ensureAccess = async () => {
      try {
        const user = (await apiGet('/api/users/me/')) as ApiUser;
        setCurrentUser(user);
        if (!user.is_staff) {
          router.replace('/teacher/access-denied');
        }
      } catch (err) {
        console.error('failed to load current user', err);
        router.replace('/auth/signin?callbackUrl=/teacher/dashboard');
      } finally {
        setLoading(false);
      }
    };

    if (status === 'authenticated') {
      ensureAccess();
    }
    if (status === 'unauthenticated') {
      router.replace('/auth/signin?callbackUrl=/teacher/dashboard');
    }
  }, [status, router, isPublicPath]);

  if (isPublicPath) {
    return <>{children}</>;
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!currentUser?.is_staff) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <TeacherNavigation />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
