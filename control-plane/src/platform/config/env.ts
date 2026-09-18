import {
  type DatabaseEnv,
  databaseSchema,
  type Env,
  envSchema,
} from '@platform/config/env.schema';
import type { z } from 'zod';

const parsed = <T>(result: z.ZodSafeParseResult<T>): T => {
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return result.data;
};

export function parseEnv(): Env {
  return parsed(envSchema.safeParse(process.env));
}

export const publicUrlOf = (env: Env): string =>
  env.SPOTLIGHT_PUBLIC_URL ?? env.BETTER_AUTH_URL;

export const webhookUrlOf = (env: Env): string =>
  env.SPOTLIGHT_WEBHOOK_URL ?? publicUrlOf(env);

export function parseDatabaseEnv(): DatabaseEnv {
  return parsed(databaseSchema.safeParse(process.env));
}
