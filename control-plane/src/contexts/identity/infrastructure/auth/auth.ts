import { bearerSessions } from '@identity/infrastructure/auth/bearer-sessions';
import { oneAccountPerProviderAccount } from '@identity/infrastructure/auth/one-account-per-provider-account';
import type { RateLimitStorage } from '@identity/infrastructure/auth/redis-rate-limit';
import * as schema from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import { createRelationalDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { deviceAuthorization } from 'better-auth/plugins';
import type { Pool } from 'pg';

export const CLI_CLIENT_ID = 'spotlight-cli';

const DEVICE_CODE_PATH = '/device/code';

const fieldOf = (body: unknown, field: string): unknown =>
  typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)[field]
    : undefined;

const refusesClientChosenFields = createAuthMiddleware(async (ctx) => {
  const body: unknown = ctx.body;

  if (
    ctx.path === DEVICE_CODE_PATH &&
    (fieldOf(body, 'user_id') !== undefined ||
      fieldOf(body, 'scope') !== undefined)
  ) {
    throw new APIError('BAD_REQUEST', {
      error: 'invalid_request',
      error_description: 'A device code takes only client_id.',
    });
  }
});

export const createAuth = (
  env: Env,
  pool: Pool,
  rateLimit: RateLimitStorage | null,
) =>
  betterAuth({
    database: drizzleAdapter(createRelationalDatabase(pool, schema), {
      provider: 'pg',
      schema,
    }),
    advanced: { database: { joins: true } },
    ...(rateLimit && { rateLimit: { customStorage: rateLimit } }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    account: { encryptOAuthTokens: true },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    hooks: { before: refusesClientChosenFields },
    plugins: [
      bearerSessions(),
      oneAccountPerProviderAccount(),
      deviceAuthorization({
        verificationUri: new URL('/device', publicUrlOf(env)).toString(),
        expiresIn: '15m',
        interval: '5s',
        validateClient: (clientId) => clientId === CLI_CLIENT_ID,
      }),
    ],
  });

export type AppAuth = ReturnType<typeof createAuth>;
