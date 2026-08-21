import { createAuth } from '@infrastructure/auth/auth';
import { parseEnv } from '@infrastructure/config/env';
import {
  createDatabase,
  createPool,
} from '@infrastructure/persistence/drizzle/drizzle.client';

const env = parseEnv();

export const auth = createAuth(env, createDatabase(createPool(env)));
