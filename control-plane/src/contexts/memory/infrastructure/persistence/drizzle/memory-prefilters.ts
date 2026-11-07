import { memory } from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';

export const activeAsOf = (at: Date | null) =>
  at
    ? and(
        lte(memory.approvedAt, at),
        or(isNull(memory.retiredAt), gt(memory.retiredAt, at)),
      )
    : eq(memory.status, 'active');
