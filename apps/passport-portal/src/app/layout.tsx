import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Agent Passport - Sign in with Google, but for Agents',
  description: 'OAuth-like identity and verification layer for AI agents. Secure agent authentication using Ed25519 keys, challenge-response auth, and risk scoring.',
  keywords: [
    'agent passport',
    'agent identity',
    'oauth for agents',
    'sign in with agent',
    'verify agent',
    'agent authentication',
    'Ed25519',
    'JWT',
    'AI agents',
    'rate limiting',
    'reputation',
    'risk scoring',
  ],
  openGraph: {
    title: 'Agent Passport - Sign in with Google, but for Agents',
    description: 'OAuth-like identity and verification layer for AI agents',
    type: 'website',
    url: 'https://agentpassport.dev',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agent Passport - Sign in with Google, but for Agents',
    description: 'OAuth-like identity and verification layer for AI agents',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100`}>
        {children}
      </body>
    </html>
  );
}
