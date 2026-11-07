import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  RunUsageWriterPort,
  UsageReadings,
} from '@runs/application/ports/run-usage-writer.port';
import type { RecordedRunUsage } from '@runs/domain/entities/recorded-run-usage.entity';
import { isJournalledAttempt } from '@runs/domain/value-objects/run-journalled-attempts';
import type { AttemptReading } from '@runs/domain/value-objects/run-usage.vo';
import { JournalBuilder } from '@runs/infrastructure/acp/journal-builder';
import {
  run,
  runJournalEntry,
  runUsage,
} from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { asc, eq } from 'drizzle-orm';

export const readingOf = (
  journal: JournalBuilder,
  handedOver: boolean,
): AttemptReading => ({
  handedOver,
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
export class DrizzleRunUsages implements RunUsageWriterPort {
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

    const entries = await this.context.db
      .select({
        attempt: runJournalEntry.attempt,
        type: runJournalEntry.type,
        at: runJournalEntry.at,
        message: runJournalEntry.message,
        data: runJournalEntry.data,
      })
      .from(runJournalEntry)
      .where(eq(runJournalEntry.runId, runId.value))
      .orderBy(asc(runJournalEntry.attempt), asc(runJournalEntry.seq));
    const journals = new Map<number, JournalBuilder>([
      [found.attempt, new JournalBuilder()],
    ]);

    for (const row of entries) {
      const journal = journals.get(row.attempt) ?? new JournalBuilder();

      journals.set(row.attempt, journal);
      journal.take(row);
    }

    return {
      attempt: found.attempt,
      readings: [...journals.entries()]
        .sort(([one], [other]) => one - other)
        .map(([attempt, journal]) =>
          readingOf(
            journal,
            isJournalledAttempt(attempt, {
              attempt: found.attempt,
              suspendedAttempts: found.suspended,
            }),
          ),
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
          attempt: recorded.run.attempt.number,
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
}
