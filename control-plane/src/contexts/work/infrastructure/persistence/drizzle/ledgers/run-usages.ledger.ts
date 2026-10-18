import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunSpent } from '@work/application/contracts/run-journal.contract';
import {
  HARNESS_LAUNCH,
  type HarnessLaunchPort,
} from '@work/application/ports/harness-launch.port';
import type {
  RunSpend,
  RunSpendReaderPort,
} from '@work/application/ports/run-spend-reader.port';
import type { RunToolsReaderPort } from '@work/application/ports/run-tools-reader.port';
import type {
  RunUsage,
  RunUsageReaderPort,
} from '@work/application/ports/run-usage-reader.port';
import type { RunUsageWriterPort } from '@work/application/ports/run-usage-writer.port';
import { changedLinesOf } from '@work/domain/services/change-hunks';
import { toolUseOf } from '@work/domain/services/tool-attribution';
import { Money } from '@work/domain/value-objects/money.vo';
import { TERMINAL_RUN_STATES } from '@work/domain/value-objects/run-state';
import { faulted } from '@work/domain/value-objects/step-status';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { ToolUse } from '@work/domain/value-objects/tool-use.vo';
import { JournalBuilder } from '@work/infrastructure/acp/journal-builder';
import {
  run,
  runJournalEntry,
  runUsage,
} from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, asc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';

const AT_A_TIME = 25;

interface RunActivity {
  readonly ms: number | null;
  readonly statuses: readonly (string | null)[];
  readonly changes: readonly {
    readonly path: string | null;
    readonly before: string;
    readonly after: string;
  }[];
  readonly contextTokens: number | null;
  readonly contextWindow: number | null;
  readonly cost: Money | null;
  readonly tokens: Tokens;
}

export const tokensAcross = (readings: readonly JournalBuilder[]): Tokens =>
  readings.reduce(
    (all, reading) => all.plus(reading.tokens()),
    Tokens.UNREPORTED,
  );

export const spentAcross = (
  readings: readonly JournalBuilder[],
): RunSpent | null => {
  const latest =
    readings
      .map((reading) => reading.spent())
      .filter((each) => each !== null)
      .pop() ?? null;
  const bySession = new Map<string, RunSpent>();

  for (const reading of readings) {
    for (const [session, spent] of reading.spentBySession()) {
      bySession.set(session, spent);
    }
  }

  const costs = [...bySession.values()].flatMap((each) =>
    each.cost && each.cost.currency === latest?.cost?.currency
      ? [each.cost]
      : [],
  );

  return latest
    ? {
        ...latest,
        cost: costs.reduce<Money | null>(
          (sum, cost) => (sum ? sum.plus(cost) : cost),
          null,
        ),
      }
    : null;
};

export const spendAcross = (readings: readonly JournalBuilder[]): RunSpend => {
  const bySession = new Map<string, RunSpent>();

  for (const reading of readings) {
    for (const [session, spent] of reading.spentBySession()) {
      bySession.set(session, spent);
    }
  }

  const sessions = [...bySession.values()];
  const costs = new Map<string, Money>();

  for (const each of sessions) {
    if (each.cost) {
      const existing = costs.get(each.cost.currency);

      costs.set(
        each.cost.currency,
        existing ? existing.plus(each.cost) : each.cost,
      );
    }
  }

  return {
    costs: [...costs.values()],
    unpricedSessions: sessions.filter((each) => each.cost === null).length,
    called:
      sessions.length > 0 ||
      readings.some((reading) => !reading.tokens().equals(Tokens.UNREPORTED)),
  };
};

export const usageOf = (activity: RunActivity): RunUsage => ({
  ms: activity.ms,
  steps: activity.statuses.length,
  errors: activity.statuses.filter(faulted).length,
  changedLines: changedLinesOf(activity.changes),
  contextTokens: activity.contextTokens,
  contextWindow: activity.contextWindow,
  cost: activity.cost,
  tokens: activity.tokens,
});

const chunked = <T>(all: readonly T[], size: number): T[][] => {
  const batches: T[][] = [];

  for (let at = 0; at < all.length; at += size) {
    batches.push(all.slice(at, at + size));
  }

  return batches;
};

@Injectable()
export class DrizzleRunUsages
  implements
    RunUsageReaderPort,
    RunUsageWriterPort,
    RunToolsReaderPort,
    RunSpendReaderPort
{
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(HARNESS_LAUNCH) private readonly launch: HarnessLaunchPort,
  ) {}

  async spendOf(runId: RunId): Promise<RunSpend> {
    const entries = await this.db
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
    const readings = new Map<number, JournalBuilder>();

    for (const row of entries) {
      const reading = readings.get(row.attempt) ?? new JournalBuilder();
      reading.take(row);
      readings.set(row.attempt, reading);
    }

    return spendAcross([...readings.values()]);
  }

  async ensure(runIds: readonly RunId[]): Promise<void> {
    const ids = [...new Set(runIds.map((each) => each.value))];

    if (ids.length === 0) {
      return;
    }

    await this.write(inArray(run.id, ids));
  }

  async catchUp(): Promise<void> {
    await this.write();
  }

  private async write(only?: SQL): Promise<void> {
    const pending = await this.db
      .select({
        id: run.id,
        attempt: run.attempt,
        suspended: run.suspendedAttempts,
      })
      .from(run)
      .leftJoin(
        runUsage,
        and(eq(runUsage.runId, run.id), eq(runUsage.attempt, run.attempt)),
      )
      .where(
        and(
          only,
          inArray(run.state, [...TERMINAL_RUN_STATES]),
          isNull(runUsage.runId),
        ),
      );

    for (const batch of chunked(pending, AT_A_TIME)) {
      await this.record(batch);
    }
  }

  private async record(
    pending: readonly {
      id: string;
      attempt: number;
      suspended: readonly number[];
    }[],
  ): Promise<void> {
    const entries = await this.db
      .select({
        runId: runJournalEntry.runId,
        attempt: runJournalEntry.attempt,
        type: runJournalEntry.type,
        at: runJournalEntry.at,
        message: runJournalEntry.message,
        data: runJournalEntry.data,
      })
      .from(runJournalEntry)
      .where(
        or(
          ...pending.map(({ id, attempt, suspended }) =>
            and(
              eq(runJournalEntry.runId, id),
              inArray(runJournalEntry.attempt, [...suspended, attempt]),
            ),
          ),
        ),
      )
      .orderBy(
        asc(runJournalEntry.runId),
        asc(runJournalEntry.attempt),
        asc(runJournalEntry.seq),
      );

    const readings = new Map<string, JournalBuilder>();
    for (const row of entries) {
      const reading =
        readings.get(`${row.runId}:${row.attempt}`) ?? new JournalBuilder();
      reading.take(row);
      readings.set(`${row.runId}:${row.attempt}`, reading);
    }

    const homes = this.launch.skillHomes();
    const rows = pending.map(({ id, attempt, suspended }) => {
      const attempts = [...suspended, attempt]
        .sort((one, other) => one - other)
        .map((each) => readings.get(`${id}:${each}`) ?? new JournalBuilder());
      const spent = spentAcross(attempts);
      const steps = attempts.flatMap((reading) => reading.steps());
      const took = attempts
        .map((reading) => reading.ms())
        .filter((each) => each !== null);

      const usage = usageOf({
        ms: took.length > 0 ? took.reduce((sum, ms) => sum + ms, 0) : null,
        statuses: steps.map((step) => step.status),
        changes: steps.flatMap((step) => (step.change ? [step.change] : [])),
        contextTokens: spent?.used ?? null,
        contextWindow: spent?.size ?? null,
        cost: spent?.cost ?? null,
        tokens: tokensAcross(attempts),
      });
      const tools = toolUseOf(
        attempts.flatMap((reading) => reading.calls()),
        homes,
      );

      return {
        runId: id,
        attempt,
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
          servers: tools.servers.map((each) => ({
            server: each.server,
            calls: each.calls,
            failed: each.failed,
            latency: [...each.latency.counts],
            lastCallFailed: each.lastCallFailed,
          })),
          skills: [...tools.skills],
        },
      };
    });

    if (rows.length === 0) {
      return;
    }

    await this.db.insert(runUsage).values(rows).onConflictDoNothing();
  }

  async forRuns(runIds: readonly RunId[]): Promise<Map<string, RunUsage>> {
    const ids = [...new Set(runIds.map((each) => each.value))];

    if (ids.length === 0) {
      return new Map();
    }

    const rows = await this.db
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

  async toolsFor(runId: RunId): Promise<ToolUse | null> {
    const [row] = await this.db
      .select({ tools: runUsage.tools })
      .from(runUsage)
      .innerJoin(
        run,
        and(eq(run.id, runUsage.runId), eq(run.attempt, runUsage.attempt)),
      )
      .where(eq(runUsage.runId, runId.value))
      .limit(1);

    return row
      ? ToolUse.of({
          servers: row.tools.servers.map((called) => ({
            ...called,
            latency: LatencyHistogram.of(called.latency),
          })),
          skills: row.tools.skills,
        })
      : null;
  }
}
