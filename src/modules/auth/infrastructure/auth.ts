import { createHmac } from 'node:crypto';

import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { hash, verify } from '@node-rs/argon2';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, isAPIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins';

import { requireAuthConfig, type AppConfig } from '@/config/env';
import { database } from '@/shared/infrastructure/db/client';
import * as schema from '@/shared/infrastructure/db/schema';

import { SignInAttempts } from '../application/sign-in-attempts';
import {
  AuditEvent,
  type AuditEventType,
  type AuditOutcome,
} from '../domain/audit-event';
import { DrizzleAuditLogWriter } from './drizzle-audit-log-writer';
import { DrizzleLockoutAttemptStore } from './drizzle-lockout-attempt-store';

// Argon2id is the @node-rs/argon2 default algorithm (Algorithm.Argon2id = 2).
const argon2idOptions = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
} as const;
const genericSignInError = 'Correo o contraseña inválidos.';
const signInPath = '/sign-in/email';

type AuditPayload = Readonly<{
  actorUserId?: string | null;
  metadata?: Record<string, string>;
}>;

export const createAuth = (appConfig: AppConfig) => {
  const authConfig = requireAuthConfig(appConfig);
  const auditLog = new DrizzleAuditLogWriter(database);
  const signInAttempts = new SignInAttempts({
    auditLog,
    clock: () => new Date(),
    hashSubject: (email) =>
      createHmac('sha256', authConfig.secret)
        .update(email.trim().toLowerCase())
        .digest('hex'),
    store: new DrizzleLockoutAttemptStore(database),
  });

  const audit = (
    eventType: AuditEventType,
    outcome: AuditOutcome,
    payload: AuditPayload = {},
  ) => auditLog.write(AuditEvent.create({ eventType, outcome, ...payload }));

  const emailFrom = (body: unknown): string | null => {
    const email = (body as { email?: unknown } | undefined)?.email;
    return typeof email === 'string' ? email : null;
  };

  const before = createAuthMiddleware(async (context) => {
    if (context.path !== signInPath) {
      return;
    }
    const email = emailFrom(context.body);
    if (email && !(await signInAttempts.isAllowed(email))) {
      throw new APIError('UNAUTHORIZED', {
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: genericSignInError,
      });
    }
  });

  const after = createAuthMiddleware(async (context) => {
    const returned = context.context.returned;
    const failed = isAPIError(returned);
    const actorUserId =
      context.context.newSession?.user.id ??
      context.context.session?.user.id ??
      null;

    switch (context.path) {
      case signInPath: {
        const email = emailFrom(context.body);
        if (!email) return;
        if (!failed) {
          const userId = (returned as { user?: { id?: string } } | undefined)
            ?.user?.id;
          await signInAttempts.recordSuccess(email, userId ?? actorUserId);
          return;
        }
        if (returned.statusCode === 401) {
          await signInAttempts.recordFailure(email);
          throw new APIError('UNAUTHORIZED', {
            code: 'INVALID_EMAIL_OR_PASSWORD',
            message: genericSignInError,
          });
        }
        return;
      }
      case '/two-factor/verify-totp':
        return audit('auth.two_factor.verify', failed ? 'failure' : 'success', {
          actorUserId,
          metadata: { method: 'totp' },
        });
      case '/two-factor/verify-backup-code':
        return audit(
          failed ? 'auth.two_factor.verify' : 'auth.backup_code.used',
          failed ? 'failure' : 'success',
          { actorUserId, metadata: { method: 'backup_code' } },
        );
      case '/two-factor/enable':
        if (failed) return;
        return audit('auth.two_factor.enabled', 'success', { actorUserId });
      case '/change-password':
        return audit('auth.password.changed', failed ? 'failure' : 'success', {
          actorUserId,
        });
      case '/sign-out':
        return audit('auth.sign_out', 'success', { actorUserId });
      default:
        return;
    }
  });

  return betterAuth({
    appName: 'Valery',
    baseURL: authConfig.baseUrl,
    secret: authConfig.secret,
    trustedOrigins: [authConfig.baseUrl],
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema: {
        account: schema.accounts,
        rateLimit: schema.rateLimits,
        session: schema.sessions,
        twoFactor: schema.twoFactors,
        user: schema.users,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: (password) => hash(password, argon2idOptions),
        verify: ({ hash: passwordHash, password }) =>
          verify(passwordHash, password),
      },
    },
    session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 60 },
    advanced: { useSecureCookies: authConfig.isProduction },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        [signInPath]: { window: 60, max: 5 },
        '/two-factor/*': { window: 60, max: 5 },
      },
    },
    hooks: { before, after },
    plugins: [
      twoFactor({
        issuer: 'Valery',
        backupCodeOptions: { amount: 10 },
        accountLockout: { maxFailedAttempts: 5, durationSeconds: 15 * 60 },
      }),
      nextCookies(),
    ],
  });
};

export type ValeryAuth = ReturnType<typeof createAuth>;
