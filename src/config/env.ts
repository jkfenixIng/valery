import { z } from 'zod';

const databaseUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === 'postgresql:', {
    message: 'DATABASE_URL must use the postgresql:// scheme.',
  });

const environmentSchema = z.object({
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

export const config = createConfig(process.env);

export const hasDatabaseUrl = (appConfig: AppConfig): boolean =>
  appConfig.DATABASE_URL !== undefined;
