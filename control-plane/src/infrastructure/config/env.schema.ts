import { z } from 'zod';

const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const;

/** All a migration needs, so applying one asks for nothing it cannot use. */
export const databaseSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type DatabaseEnv = z.infer<typeof databaseSchema>;

export const envSchema = databaseSchema
  .extend({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    // Signs session cookies. Generate with: openssl rand -base64 48
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    // A GitHub App installed on the repositories tasks name. Its key mints
    // short-lived installation tokens, and never leaves this process. Which
    // installation is a workspace's own, so it is held there and not here.
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1),
    // Shared with the App's webhook. Left unset, deliveries are refused.
    GITHUB_WEBHOOK_SECRET: z.string().default(''),
    // Seals what a workspace's configuration may name but must not hold.
    // 32 bytes, base64. Generate with: openssl rand -base64 32
    SPOTLIGHT_SECRETS_KEY: z.string().min(1),
    // The control-plane base baked into the served install script. Defaults to
    // BETTER_AUTH_URL.
    SPOTLIGHT_PUBLIC_URL: z.url().optional(),
    // Where the served install script lives in this image.
    SPOTLIGHT_INSTALLER_DIR: z.string().default('/opt/spotlight/installer'),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  })
  .transform((env) => ({
    ...env,
    LOG_LEVEL:
      env.LOG_LEVEL ?? (env.NODE_ENV === 'development' ? 'debug' : 'info'),
  }));

export type Env = z.infer<typeof envSchema>;
