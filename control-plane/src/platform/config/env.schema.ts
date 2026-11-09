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

const UNIT_MS: Readonly<Record<string, number>> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 60 * 60_000,
};

const duration = (fallback: string) =>
  z
    .string()
    .regex(/^\d+(ms|s|m|h)$/, 'is a duration such as 90s, 10m or 12h')
    .default(fallback)
    .transform((raw) => {
      const [, amount, unit] = /^(\d+)(ms|s|m|h)$/.exec(raw) ?? [];
      return Number(amount) * UNIT_MS[unit];
    })
    .pipe(z.number().int().positive());

const unsetWhenEmpty = <T extends z.ZodType>(schema: T) =>
  z.preprocess((raw) => (raw === '' ? undefined : raw), schema.optional());

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
    SPOTLIGHT_SECRETS_KMS_KEY_ID: z.string().min(1).optional(),
    SECRETS_AWS_SECRETS_MANAGER: z.stringbool().default(false),
    SPOTLIGHT_PUBLIC_URL: z.url().optional(),
    SPOTLIGHT_PLATFORM_EGRESS_URL: z.url({ protocol: /^https?$/ }).optional(),
    SPOTLIGHT_PLATFORM_EGRESS_TOKEN: z
      .string()
      .regex(/^[A-Za-z0-9._~-]{32,255}$/)
      .optional(),
    // An empty value permits every public host. A private address is called only for a host the list names.
    SPOTLIGHT_OUTBOUND_ALLOWED_HOSTS: z.string().default(''),
    SPOTLIGHT_OUTBOUND_ALLOW_LOOPBACK: z.stringbool().default(false),
    SPOTLIGHT_OUTBOUND_RATE_LIMIT: z.coerce.number().min(1).default(50),
    HOOK_SIGNING_KEY: z.string().min(1).optional(),
    VAPID_PUBLIC_KEY: unsetWhenEmpty(
      z.string().regex(/^[A-Za-z0-9_-]{86,88}$/),
    ),
    VAPID_PRIVATE_KEY: unsetWhenEmpty(
      z.string().regex(/^[A-Za-z0-9_-]{42,44}$/),
    ),
    VAPID_SUBJECT: unsetWhenEmpty(z.string().regex(/^(mailto:|https:\/\/).+/)),
    OAUTH_CLIENTS: z.string().default('{}'),
    // Lets several control-plane instances share live drafts, run streams, host tunnels, the leader lease and the sign-in rate limit.
    REDIS_URL: z.url({ protocol: /^rediss?$/ }).optional(),
    SPOTLIGHT_INSTANCE_URL: z.url({ protocol: /^http$/ }).optional(),
    SPOTLIGHT_LONG_POLL_MS: z.coerce.number().int().positive().default(10_000),
    SPOTLIGHT_SANDBOX_GRACE: duration('10m'),
    SPOTLIGHT_EDITOR_LIMIT: duration('12h'),
    SPOTLIGHT_WARM_SANDBOX_AGE: duration('24h'),
    SPOTLIGHT_MCP_RELIST_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(600),
    SPOTLIGHT_CATALOG_URL: z.url().default('https://catalog.usespotlight.ai'),
    SPOTLIGHT_CATALOG_TOKEN: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1),
    S3_KEY_PREFIX: z.string().optional(),
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
    LLM_BASE_URL: unsetWhenEmpty(z.url({ protocol: /^https?$/ })),
    LLM_API_KEY: unsetWhenEmpty(z.string().min(1)),
    LLM_MODEL: unsetWhenEmpty(z.string().min(1)),
    LLM_SUPPORTS_REASONING_EFFORT: z.stringbool().default(false),
    CHANGE_STACK_MODEL: unsetWhenEmpty(z.string().min(1)),
    DECISIONS_MODEL: unsetWhenEmpty(z.string().min(1)),
    MEMORIES_MODEL: unsetWhenEmpty(z.string().min(1)),
    JUDGE_MODEL: unsetWhenEmpty(z.string().min(1)),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  })
  .refine(
    (env) => env.SPOTLIGHT_SECRETS_KEY || env.SPOTLIGHT_SECRETS_KMS_KEY_ID,
    {
      path: ['SPOTLIGHT_SECRETS_KEY'],
      message:
        'wraps each workspace data key when SPOTLIGHT_SECRETS_KMS_KEY_ID names no AWS KMS key; generate one with: openssl rand -base64 32',
    },
  )
  .refine(
    (env) =>
      (env.SPOTLIGHT_PLATFORM_EGRESS_URL === undefined) ===
      (env.SPOTLIGHT_PLATFORM_EGRESS_TOKEN === undefined),
    {
      path: ['SPOTLIGHT_PLATFORM_EGRESS_TOKEN'],
      message:
        'goes with SPOTLIGHT_PLATFORM_EGRESS_URL. Set both to name the platform egress, or neither; generate a token with: openssl rand -hex 32',
    },
  )
  .refine(
    (env) =>
      [env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT].every(
        (each) => each === undefined,
      ) ||
      [env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT].every(
        (each) => each !== undefined,
      ),
    {
      path: ['VAPID_PUBLIC_KEY'],
      message:
        'goes with VAPID_PRIVATE_KEY and VAPID_SUBJECT. Set all three to send Web Push, or none; generate a key pair with: npx web-push generate-vapid-keys',
    },
  )
  .refine(
    (env) =>
      (env.LLM_BASE_URL === undefined) ===
      [
        env.LLM_MODEL,
        env.CHANGE_STACK_MODEL,
        env.DECISIONS_MODEL,
        env.MEMORIES_MODEL,
        env.JUDGE_MODEL,
      ].every((model) => model === undefined),
    {
      path: ['LLM_BASE_URL'],
      message:
        'goes with LLM_MODEL. Set a base URL and a model to use a model endpoint, or set neither',
    },
  )
  .transform((env) => ({
    ...env,
    LOG_LEVEL:
      env.LOG_LEVEL ?? (env.NODE_ENV === 'development' ? 'debug' : 'info'),
  }));

export type Env = z.infer<typeof envSchema>;
