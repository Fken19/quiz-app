'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import StudentNavigation from './StudentNavigation';
import LoadingSpinner from '@/components/LoadingSpinner';

interface StudentShellProps {
  children: React.ReactNode;
}

const AUTH_FREE_PATHS = new Set<string>(['/student/login', '/student/access-denied']);

export default function StudentShell({ children }: StudentShellProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session && !AUTH_FREE_PATHS.has(pathname)) {
      router.push('/auth/signin');
    }
  }, [status, session, router, pathname]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!session && !AUTH_FREE_PATHS.has(pathname)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <StudentNavigation />
      <main className="lg:ml-64 p-4 lg:p-8">
        {children}
      </main>
    </div>
  );
}
