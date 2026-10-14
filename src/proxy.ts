import { NextResponse, type NextRequest } from 'next/server';

import { getSecurityEnvironment } from '@/config/env';
import { createContentSecurityPolicy } from '@/config/security';

const createNonce = (): string =>
  Buffer.from(crypto.randomUUID()).toString('base64');

const sessionCookieNames = [
  'better-auth.session_token',
  '__Secure-better-auth.session_token',
];

// Optimistic only: the admin layout and route handlers perform the real check.
const isAnonymousAdminRequest = (request: NextRequest): boolean =>
  request.nextUrl.pathname.startsWith('/admin') &&
  !sessionCookieNames.some((name) => request.cookies.has(name));

export function proxy(request: NextRequest) {
  if (isAnonymousAdminRequest(request)) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }

  const nonce = createNonce();
  const contentSecurityPolicy = createContentSecurityPolicy(
    getSecurityEnvironment(),
    nonce,
  );
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('Content-Security-Policy', contentSecurityPolicy);

  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
