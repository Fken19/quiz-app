import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientWrapper from '@/components/ClientWrapper';

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

  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* client-only setter to avoid hydration mismatch */}
        <ClientWrapper>
          {/* VscDomainSetter sets --vsc-domain on client mount */}
          {/* eslint-disable-next-line @next/next/no-server-import-in-client */}
          {/* import dynamically to avoid bundling in server bundle */}
          <script dangerouslySetInnerHTML={{ __html: `(${String(() => {
            try {
              const domain = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_VSC_DOMAIN)
                ? process.env.NEXT_PUBLIC_VSC_DOMAIN
                : (typeof window !== 'undefined' ? window.location.hostname : '');
              document.documentElement.style.setProperty('--vsc-domain', domain || '');
            } catch (e) {}
          })})()` }} />
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}
