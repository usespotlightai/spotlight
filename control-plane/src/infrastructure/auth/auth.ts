import { env } from '@infrastructure/config/env';
import { db } from '@infrastructure/persistence/drizzle/drizzle.client';
import * as schema from '@infrastructure/persistence/drizzle/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
});
