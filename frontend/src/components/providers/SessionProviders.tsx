'use client';

import { SessionProvider } from 'next-auth/react';

interface SessionProvidersProps {
  children: React.ReactNode;
}

export default function SessionProviders({ children }: SessionProvidersProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
