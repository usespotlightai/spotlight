import { createAuth } from '@identity/infrastructure/auth/auth';
import { parseEnv } from '@platform/config/env';
import {
  createDatabase,
  createPool,
} from '@platform/persistence/drizzle/drizzle.client';

const env = parseEnv();

export const auth = createAuth(env, createDatabase(createPool(env)));
