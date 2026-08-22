import type { Env } from '@infrastructure/config/env.schema';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import * as schema from '@infrastructure/persistence/drizzle/schemas';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export const createAuth = (env: Env, db: DrizzleDatabase) =>
  betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
    },
  });

export type AppAuth = ReturnType<typeof createAuth>;
