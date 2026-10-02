import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  SearchRunFact,
  SearchRunFactsPort,
} from '@work/application/ports/search-run-facts.port';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, inArray, isNotNull } from 'drizzle-orm';

@Injectable()
export class DrizzleSearchRunFacts implements SearchRunFactsPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async of(runIds: readonly string[]): Promise<readonly SearchRunFact[]> {
    if (runIds.length === 0) {
      return [];
    }

    return this.db
      .select({
        runId: run.id,
        state: run.state,
        askedAPerson: run.askedAPerson,
        attempt: run.attempt,
        queuedAt: run.queuedAt,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
      })
      .from(run)
      .where(and(inArray(run.id, [...runIds]), isNotNull(run.searchId)));
  }
}
