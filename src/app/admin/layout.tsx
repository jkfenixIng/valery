import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { container } from '@/composition/container';

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const access = await container.auth.getAdminAccess(await headers());

  if (access === 'anonymous') redirect('/auth/sign-in');
  if (access === 'two_factor_setup_required')
    redirect('/auth/two-factor/setup');

  return children;
}
