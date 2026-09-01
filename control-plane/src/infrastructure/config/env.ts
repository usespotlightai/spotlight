import {
  type DatabaseEnv,
  databaseSchema,
  type Env,
  envSchema,
} from '@infrastructure/config/env.schema';
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

/** What a migration is run with, which is a database and nothing else. */
export function parseDatabaseEnv(): DatabaseEnv {
  return parsed(databaseSchema.safeParse(process.env));
}
