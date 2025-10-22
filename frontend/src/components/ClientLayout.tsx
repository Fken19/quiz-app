'use client';

import { SessionProvider } from 'next-auth/react';
import Layout from './Layout';

interface ClientLayoutProps {
  children: React.ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <SessionProvider>
      <Layout>
        {children}
      </Layout>
    </SessionProvider>
  );
}
