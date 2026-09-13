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
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1),
    GITHUB_WEBHOOK_SECRET: z.string().default(''),
    SPOTLIGHT_SECRETS_KEY: z.string().min(1),
    SPOTLIGHT_PUBLIC_URL: z.url().optional(),
    SPOTLIGHT_WEBHOOK_URL: z.url().optional(),
    // Empty allows none: templated URLs carry secrets, so the deployment decides.
    OUTBOUND_ALLOWED_HOSTS: z.string().default(''),
    OAUTH_CLIENTS: z.string().default('{}'),
    S3_BUCKET: z.string().default(''),
    S3_REGION: z.string().default('us-east-1'),
    S3_ENDPOINT: z.url().optional(),
    S3_PUBLIC_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.stringbool().default(false),
    S3_PUBLIC_FORCE_PATH_STYLE: z.stringbool().default(false),
    SMTP_URL: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(1).default('Spotlight <noreply@usespotlight.ai>'),
    SPOTLIGHT_INSTALLER_DIR: z.string().default('/opt/spotlight/installer'),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  })
  .transform((env) => ({
    ...env,
    LOG_LEVEL:
      env.LOG_LEVEL ?? (env.NODE_ENV === 'development' ? 'debug' : 'info'),
  }));

export type Env = z.infer<typeof envSchema>;
