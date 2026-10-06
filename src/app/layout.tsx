import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuditBadge } from '@/components/ui';
import './globals.css';

const sans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Ledger Console', template: '%s · Ledger Console' },
  description: 'Operator console for a double-entry ledger (ledgerd / ledger-nest).',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>
        <header className="border-b border-[var(--line)]">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-xs text-[var(--accent-text)]">L</span>
              Ledger Console
            </Link>
            <Suspense fallback={<span className="badge text-[var(--muted)]">● Checking books…</span>}>
              <AuditBadge />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
