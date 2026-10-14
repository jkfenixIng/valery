import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { ThemeProvider } from '@/shared/ui';

import { RegisterServiceWorker } from './register-service-worker';
import './globals.css';

export const metadata: Metadata = {
  title: 'Valery',
  description: 'Valery business workspace',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  await connection();

  return (
    <html lang="es-CO" suppressHydrationWarning>
      <body>
        <RegisterServiceWorker />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
