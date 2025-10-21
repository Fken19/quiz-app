import type { Metadata } from "next";
import type { CSSProperties } from 'react';

export const dynamic = "force-dynamic";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SessionProviders from '@/components/providers/SessionProviders';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quiz App",
  description: "Next.js Quiz Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Use an env var to provide a stable value for the --vsc-domain CSS variable
  // when present. This avoids hydration mismatch if some tool or extension
  // injects the same variable on the client or server.
  const vscDomain = process.env.NEXT_PUBLIC_VSC_DOMAIN ?? '';
  const styleVars = vscDomain
    ? ({ '--vsc-domain': vscDomain } as CSSProperties & Record<'--vsc-domain', string>)
    : undefined;

  return (
    // Add suppressHydrationWarning to avoid noisy mismatch errors when
    // extensions/tools mutate the DOM before React hydrates. When an
    // explicit server-side value is available via NEXT_PUBLIC_VSC_DOMAIN we
    // render it so server and client share the same initial value.
    <html
      lang="ja"
      suppressHydrationWarning
      style={styleVars}
    >
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              try {
                var domain = '${vscDomain || ''}';
                if (!domain && typeof window !== 'undefined') {
                  domain = window.location.hostname || '';
                }
                document.documentElement.style.setProperty('--vsc-domain', domain || '');
              } catch (e) {}
            })()`,
          }}
        />
        <SessionProviders>{children}</SessionProviders>
      </body>
    </html>
  );
}
