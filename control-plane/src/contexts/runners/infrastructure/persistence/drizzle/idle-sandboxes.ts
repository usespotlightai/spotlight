import { LIVE_SANDBOX_STATES } from '@runners/domain/aggregates/sandbox.aggregate';
import { sandbox } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import { and, inArray, isNotNull } from 'drizzle-orm';

export const isIdleSandbox = () =>
  and(
    inArray(sandbox.state, [...LIVE_SANDBOX_STATES]),
    isNotNull(sandbox.idleSince),
  );
