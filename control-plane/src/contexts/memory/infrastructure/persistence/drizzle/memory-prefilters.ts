import { memory } from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { and, eq, gt, isNull, lte, or, type SQL } from 'drizzle-orm';

export const activeAsOf = (at: Date | null): SQL | undefined =>
  at
    ? and(
        lte(memory.approvedAt, at),
        or(isNull(memory.retiredAt), gt(memory.retiredAt, at)),
      )
    : eq(memory.status, 'active');
