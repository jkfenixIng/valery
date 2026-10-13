import { z } from 'zod';

const databaseUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === 'postgresql:', {
    message: 'DATABASE_URL must use the postgresql:// scheme.',
  });

const environmentSchema = z.object({
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  DATABASE_URL: databaseUrlSchema.optional(),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export const createConfig = (
  environment: Record<string, string | undefined>,
): AppConfig => {
  const parsed = environmentSchema.safeParse(environment);

  if (!parsed.success) {
    throw new ConfigurationError('Invalid environment configuration.');
  }

  return parsed.data;
};

export const requireDatabaseUrl = (config: AppConfig): string => {
  if (!config.DATABASE_URL) {
    throw new ConfigurationError(
      'DATABASE_URL is required when a database adapter is enabled.',
    );
  }

  return config.DATABASE_URL;
};

export type AuthConfig = Readonly<{
  baseUrl: string;
  isProduction: boolean;
  secret: string;
}>;

export const requireAuthConfig = (appConfig: AppConfig): AuthConfig => {
  if (!appConfig.BETTER_AUTH_SECRET || !appConfig.BETTER_AUTH_URL) {
    throw new ConfigurationError(
      'BETTER_AUTH_SECRET and BETTER_AUTH_URL are required when authentication is enabled.',
    );
  }

  return {
    baseUrl: appConfig.BETTER_AUTH_URL,
    isProduction: appConfig.NODE_ENV === 'production',
    secret: appConfig.BETTER_AUTH_SECRET,
  };
};

export type AdminSeedConfig = Readonly<{ email: string; password: string }>;

export const hasAdminSeedConfig = (appConfig: AppConfig): boolean =>
  appConfig.ADMIN_EMAIL !== undefined && appConfig.ADMIN_PASSWORD !== undefined;

export const requireAdminSeedConfig = (
  appConfig: AppConfig,
): AdminSeedConfig => {
  if (!appConfig.ADMIN_EMAIL || !appConfig.ADMIN_PASSWORD) {
    throw new ConfigurationError(
      'ADMIN_EMAIL and ADMIN_PASSWORD are required to seed the administrator.',
    );
  }

  return { email: appConfig.ADMIN_EMAIL, password: appConfig.ADMIN_PASSWORD };
};

export type EndToEndConfig = AdminSeedConfig & Readonly<{ baseUrl: string }>;

export const requireEndToEndConfig = (appConfig: AppConfig): EndToEndConfig => {
  requireDatabaseUrl(appConfig);
  return {
    ...requireAdminSeedConfig(appConfig),
    baseUrl: requireAuthConfig(appConfig).baseUrl,
  };
};

export const config = createConfig(process.env);

export const getSecurityEnvironment = (): AppConfig['NODE_ENV'] =>
  config.NODE_ENV;

export const hasDatabaseUrl = (appConfig: AppConfig): boolean =>
  appConfig.DATABASE_URL !== undefined;
