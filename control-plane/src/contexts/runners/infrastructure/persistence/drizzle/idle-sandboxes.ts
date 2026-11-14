import { sandbox } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import { and, isNotNull, ne } from 'drizzle-orm';

export const isIdleSandbox = () =>
  and(ne(sandbox.state, 'gone'), isNotNull(sandbox.idleSince));
