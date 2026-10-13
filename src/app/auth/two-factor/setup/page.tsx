import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { container } from '@/composition/container';
import { TwoFactorSetupForm } from '@/modules/auth/presentation';

export default async function TwoFactorSetupPage() {
  const access = await container.auth.getAdminAccess(await headers());

  if (access === 'anonymous') redirect('/auth/sign-in');
  if (access === 'granted') redirect('/admin');

  return (
    <main className="auth-page">
      <TwoFactorSetupForm />
    </main>
  );
}
