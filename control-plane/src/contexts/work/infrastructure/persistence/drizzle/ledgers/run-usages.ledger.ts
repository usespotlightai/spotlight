import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  RunUsage,
  RunUsageReaderPort,
} from '@work/application/ports/run-usage-reader.port';
import type {
  RunUsageWriterPort,
  UsageReadings,
} from '@work/application/ports/run-usage-writer.port';
import type { RecordedRunUsage } from '@work/domain/entities/recorded-run-usage.entity';
import { Money } from '@work/domain/value-objects/money.vo';
import type { AttemptReading } from '@work/domain/value-objects/run-usage.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { JournalBuilder } from '@work/infrastructure/acp/journal-builder';
import {
  run,
  runJournalEntry,
  runUsage,
} from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, asc, eq, inArray } from 'drizzle-orm';

export const readingOf = (journal: JournalBuilder): AttemptReading => ({
  ms: journal.ms(),
  steps: journal
    .steps()
    .map((step) => ({ status: step.status, change: step.change })),
  spent: journal.spent(),
  spentBySession: journal.spentBySession(),
  tokens: journal.tokens(),
  calls: journal.calls(),
});

@Injectable()
export class DrizzleRunUsages
  implements RunUsageReaderPort, RunUsageWriterPort
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async readingsOf(runId: RunId): Promise<UsageReadings | null> {
    const [found] = await this.context.db
      .select({ attempt: run.attempt, suspended: run.suspendedAttempts })
      .from(run)
      .where(eq(run.id, runId.value));

    if (!found) {
      return null;
    }

    const attempts = [...new Set([...found.suspended, found.attempt])].sort(
      (one, other) => one - other,
    );
    const entries = await this.context.db
      .select({
        attempt: runJournalEntry.attempt,
        type: runJournalEntry.type,
        at: runJournalEntry.at,
        message: runJournalEntry.message,
        data: runJournalEntry.data,
      })
      .from(runJournalEntry)
      .where(
        and(
          eq(runJournalEntry.runId, runId.value),
          inArray(runJournalEntry.attempt, attempts),
        ),
      )
      .orderBy(asc(runJournalEntry.attempt), asc(runJournalEntry.seq));
    const journals = new Map(
      attempts.map((each) => [each, new JournalBuilder()]),
    );

    for (const row of entries) {
      journals.get(row.attempt)?.take(row);
    }

    return {
      attempt: found.attempt,
      readings: attempts.map((each) =>
        readingOf(journals.get(each) ?? new JournalBuilder()),
      ),
    };
  }

  async record(recorded: RecordedRunUsage): Promise<void> {
    const { usage } = recorded;

    await this.context.inTransaction(async () => {
      const inserted = await this.context.db
        .insert(runUsage)
        .values({
          runId: recorded.run.id.value,
          attempt: recorded.run.attempt,
          ms: usage.ms,
          steps: usage.steps,
          errors: usage.errors,
          changedLines: usage.changedLines,
          contextTokens: usage.contextTokens,
          contextWindow: usage.contextWindow,
          cost: usage.cost?.amount ?? null,
          currency: usage.cost?.currency ?? null,
          inputTokens: usage.tokens.input,
          outputTokens: usage.tokens.output,
          cacheReadTokens: usage.tokens.cacheRead,
          cacheWriteTokens: usage.tokens.cacheWrite,
          tools: {
            servers: usage.tools.servers.map((each) => ({
              server: each.server,
              calls: each.calls,
              failed: each.failed,
              latency: [...each.latency.counts],
              lastCallFailed: each.lastCallFailed,
            })),
            skills: [...usage.tools.skills],
          },
        })
        .onConflictDoNothing()
        .returning({ runId: runUsage.runId });
      const usageRecorded = recorded.recordedFirst(inserted.length > 0);

      if (usageRecorded) {
        await this.events.dispatch([usageRecorded]);
      }
    });
  }

  async forRuns(runIds: readonly RunId[]): Promise<Map<string, RunUsage>> {
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
          cost: Money.maybe(each.cost, each.currency),
          tokens: Tokens.of({
            input: each.inputTokens,
            output: each.outputTokens,
            cacheRead: each.cacheReadTokens,
            cacheWrite: each.cacheWriteTokens,
          }),
        },
      ]),
    );
  }
}
