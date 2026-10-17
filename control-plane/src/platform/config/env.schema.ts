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
    DATABASE_READ_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
    DATABASE_READ_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15_000),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_APP_PRIVATE_KEY: z.string().min(1),
    GITHUB_WEBHOOK_SECRET: z.string().default(''),
    SPOTLIGHT_SECRETS_KEY: z.string().min(1).optional(),
    SECRETS_KMS_KEY_ID: z.string().min(1).optional(),
    SECRETS_AWS_SECRETS_MANAGER: z.stringbool().default(false),
    SPOTLIGHT_PUBLIC_URL: z.url().optional(),
    SPOTLIGHT_PLATFORM_EGRESS_URL: z.url({ protocol: /^https?$/ }).optional(),
    SPOTLIGHT_PLATFORM_EGRESS_TOKEN: z
      .string()
      .regex(/^[A-Za-z0-9._~-]{32,255}$/)
      .optional(),
    // An empty value permits no hosts. The deployment decides which hosts Spotlight can call.
    OUTBOUND_ALLOWED_HOSTS: z.string().default(''),
    HOOK_SIGNING_KEY: z.string().min(1).optional(),
    OAUTH_CLIENTS: z.string().default('{}'),
    SPOTLIGHT_LONG_POLL_MS: z.coerce.number().int().positive().default(10_000),
    MCP_RELIST_SECONDS: z.coerce.number().int().positive().default(600),
    SPOTLIGHT_CATALOG_URL: z.url().default('https://catalog.usespotlight.ai'),
    SPOTLIGHT_CATALOG_TOKEN: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1),
    S3_REGION: z.string().default('us-east-1'),
    S3_ENDPOINT: z.url().optional(),
    S3_PUBLIC_ENDPOINT: z.url().optional(),
    S3_RUNNER_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.stringbool().default(false),
    S3_PUBLIC_FORCE_PATH_STYLE: z.stringbool().default(false),
    SMTP_URL: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(1).default('Spotlight <noreply@usespotlight.ai>'),
    SPOTLIGHT_INSTALLER_DIR: z.string().default('/opt/spotlight/installer'),
    SPOTLIGHT_RELEASE: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    SENTRY_WEB_DSN: z.string().optional(),
    SENTRY_ENVIRONMENT: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    CHANGE_STACK_MODEL: z.string().min(1).default('google/gemini-3.8-flash'),
    DECISIONS_MODEL: z.string().min(1).default('google/gemini-3.8-flash'),
    MEMORIES_MODEL: z.string().min(1).default('google/gemini-3.8-flash'),
    JUDGE_MODEL: z.string().min(1).default('google/gemini-3.8-flash'),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  })
  .refine((env) => env.SPOTLIGHT_SECRETS_KEY || env.SECRETS_KMS_KEY_ID, {
    path: ['SPOTLIGHT_SECRETS_KEY'],
    message:
      'wraps each workspace data key when SECRETS_KMS_KEY_ID names no AWS KMS key; generate one with: openssl rand -base64 32',
  })
  .refine(
    (env) =>
      (env.SPOTLIGHT_PLATFORM_EGRESS_URL === undefined) ===
      (env.SPOTLIGHT_PLATFORM_EGRESS_TOKEN === undefined),
    {
      path: ['SPOTLIGHT_PLATFORM_EGRESS_TOKEN'],
      message:
        'goes with SPOTLIGHT_PLATFORM_EGRESS_URL. Give both to name the platform egress, or neither; generate a token with: openssl rand -hex 32',
    },
  )
  .transform((env) => ({
    ...env,
    LOG_LEVEL:
      env.LOG_LEVEL ?? (env.NODE_ENV === 'development' ? 'debug' : 'info'),
  }));

export type Env = z.infer<typeof envSchema>;
