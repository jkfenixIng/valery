import { z } from 'zod';

const environmentSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export const createConfig = (environment: Record<string, string | undefined>): AppConfig => {
  const parsed = environmentSchema.safeParse(environment);

  if (!parsed.success) {
    throw new ConfigurationError('Invalid environment configuration.');
  }

  return parsed.data;
};

export const requireDatabaseUrl = (config: AppConfig): string => {
  if (!config.DATABASE_URL) {
    throw new ConfigurationError('DATABASE_URL is required when a database adapter is enabled.');
  }

  return config.DATABASE_URL;
};

// DATABASE_URL remains optional until a database adapter is introduced.
export const config = createConfig(process.env);
