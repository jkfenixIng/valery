import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { ThemeProvider } from '@/shared/ui';

import './globals.css';

export const metadata: Metadata = {
  title: 'Valery',
  description: 'Valery business workspace',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-CO" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
