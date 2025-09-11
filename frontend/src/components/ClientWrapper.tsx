'use client';

import { SessionProvider } from 'next-auth/react';
import QueryProvider from './QueryProvider';
import MainLayout from './MainLayout';

interface ClientWrapperProps {
  children: React.ReactNode;
}

export default function ClientWrapper({ children }: ClientWrapperProps) {
  return (
    <SessionProvider>
      <QueryProvider>
        <MainLayout>
          {children}
        </MainLayout>
      </QueryProvider>
    </SessionProvider>
  );
}
