import { parseDatabaseEnv } from '@platform/config/env';
import {
  createDatabase,
  logPoolErrorToStderr,
  openPool,
} from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { DrizzleAcp1Journals } from '@runs/infrastructure/persistence/drizzle/ledgers/acp-1-journals.ledger';

export interface Acp1JournalsRewrite {
  readonly journals: DrizzleAcp1Journals;
  readonly close: () => Promise<void>;
}

export const openAcp1JournalsRewrite = (): Acp1JournalsRewrite => {
  const env = parseDatabaseEnv();
  const pool = openPool(env, env.DATABASE_URL, logPoolErrorToStderr);

  return {
    journals: new DrizzleAcp1Journals(new DrizzleContext(createDatabase(pool))),
    close: () => pool.end(),
  };
};
