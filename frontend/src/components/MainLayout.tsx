'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Navigation from './Navigation';
import LoadingSpinner from './LoadingSpinner';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!session) {
    return <>{children}</>;
  }

  const mainClass = pathname?.startsWith('/admin-dashboard')
    ? 'p-4 lg:p-8'
    : 'lg:ml-64 p-4 lg:p-8';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className={mainClass}>
        {children}
      </main>
    </div>
  );
}
