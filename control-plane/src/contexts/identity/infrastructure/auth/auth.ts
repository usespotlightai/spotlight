import { bearerSessions } from '@identity/infrastructure/auth/bearer-sessions';
import type { RateLimitStorage } from '@identity/infrastructure/auth/redis-rate-limit';
import * as schema from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import { publicUrlOf } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { deviceAuthorization } from 'better-auth/plugins';

export const CLI_CLIENT_ID = 'spotlight-cli';

const DEVICE_CODE_PATH = '/device/code';

const refusesClientChosenFields = createAuthMiddleware(async (ctx) => {
  if (
    ctx.path === DEVICE_CODE_PATH &&
    (ctx.body?.user_id !== undefined || ctx.body?.scope !== undefined)
  ) {
    throw new APIError('BAD_REQUEST', {
      error: 'invalid_request',
      error_description: 'A device code takes only client_id.',
    });
  }
});

export const createAuth = (
  env: Env,
  db: DrizzleDatabase,
  rateLimit: RateLimitStorage | null,
) =>
  betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    ...(rateLimit && { rateLimit: { customStorage: rateLimit } }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    hooks: { before: refusesClientChosenFields },
    plugins: [
      bearerSessions(),
      deviceAuthorization({
        verificationUri: new URL('/device', publicUrlOf(env)).toString(),
        expiresIn: '15m',
        interval: '5s',
        validateClient: (clientId) => clientId === CLI_CLIENT_ID,
      }),
    ],
  });

export type AppAuth = ReturnType<typeof createAuth>;
