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
    <html lang="ja" style={{ ['--vsc-domain' as any]: vscDomain }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientWrapper>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}
