import { createAuth } from '@identity/infrastructure/auth/auth';
import { parseEnv } from '@platform/config/env';
import {
  openPool,
  logPoolErrorToStderr,
} from '@platform/persistence/drizzle/drizzle.client';

const env = parseEnv();

export const auth = createAuth(
  env,
  openPool(env, env.DATABASE_URL, logPoolErrorToStderr),
  null,
);
