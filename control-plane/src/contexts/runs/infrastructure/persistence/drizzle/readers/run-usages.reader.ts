import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  RunUsageFacts,
  RunUsageReaderPort,
} from '@runs/application/ports/run-usage-reader.port';
import {
  run,
  runUsage,
} from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { and, eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleRunUsagesReader implements RunUsageReaderPort {
  constructor(private readonly context: DrizzleContext) {}

  async forRuns(runIds: readonly RunId[]): Promise<Map<string, RunUsageFacts>> {
    const ids = [...new Set(runIds.map((each) => each.value))];

    if (ids.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .select({
        runId: runUsage.runId,
        ms: runUsage.ms,
        steps: runUsage.steps,
        errors: runUsage.errors,
        changedLines: runUsage.changedLines,
        contextTokens: runUsage.contextTokens,
        contextWindow: runUsage.contextWindow,
        cost: runUsage.cost,
        currency: runUsage.currency,
        inputTokens: runUsage.inputTokens,
        outputTokens: runUsage.outputTokens,
        cacheReadTokens: runUsage.cacheReadTokens,
        cacheWriteTokens: runUsage.cacheWriteTokens,
      })
      .from(runUsage)
      .innerJoin(
        run,
        and(eq(run.id, runUsage.runId), eq(run.attempt, runUsage.attempt)),
      )
      .where(inArray(runUsage.runId, ids));

    return new Map(
      rows.map((each) => [
        each.runId,
        {
          ms: each.ms,
          steps: each.steps,
          errors: each.errors,
          changedLines: each.changedLines,
          contextTokens: each.contextTokens,
          contextWindow: each.contextWindow,
          cost:
            each.cost === null || each.currency === null
              ? null
              : { amount: each.cost, currency: each.currency },
          tokens: {
            input: each.inputTokens,
            output: each.outputTokens,
            cacheRead: each.cacheReadTokens,
            cacheWrite: each.cacheWriteTokens,
          },
        },
      ]),
    );
  }
}
