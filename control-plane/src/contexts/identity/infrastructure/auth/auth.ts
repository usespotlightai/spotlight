import * as schema from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import type { Env } from '@platform/config/env.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export const createAuth = (env: Env, db: DrizzleDatabase) =>
  betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
  });

export type AppAuth = ReturnType<typeof createAuth>;
