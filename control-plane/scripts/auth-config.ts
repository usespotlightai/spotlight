import { createAuth } from '@identity/infrastructure/auth/auth';
import { parseEnv } from '@platform/config/env';
import { poolOptions } from '@platform/persistence/drizzle/drizzle.client';
import { Pool } from 'pg';

const env = parseEnv();

export const auth = createAuth(
  env,
  new Pool(poolOptions(env, env.DATABASE_URL, 1)),
  null,
);
