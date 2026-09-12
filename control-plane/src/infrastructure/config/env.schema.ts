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
    // Hosts an integration's outbound calls (posts and polls) may reach,
    // comma-separated. Empty allows none: a templated URL carries real secrets,
    // so where it may reach is the deployment's to say, never the config author's.
    OUTBOUND_ALLOWED_HOSTS: z.string().default(''),
    // The shared OAuth2 apps, one per host, as JSON: a map from a source name
    // to its client id and secret, e.g. {"slack":{"id":"...","secret":"..."}}.
    // These are the operator's apps, never a team's, so they live here and not
    // in any team's configuration. Empty means no host can be linked.
    OAUTH_CLIENTS: z.string().default('{}'),
    S3_BUCKET: z.string().default(''),
    S3_REGION: z.string().default('us-east-1'),
    S3_ENDPOINT: z.url().optional(),
    S3_PUBLIC_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    // Whether the bucket is named in the path rather than the host: a store
    // serving every bucket at one address needs it, a real bucket does not.
    S3_FORCE_PATH_STYLE: z.stringbool().default(false),
    S3_PUBLIC_FORCE_PATH_STYLE: z.stringbool().default(false),
    SMTP_URL: z.string().min(1).optional(),
    MAIL_FROM: z.string().min(1).default('Spotlight <noreply@usespotlight.ai>'),
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
