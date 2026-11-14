import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  RunChanges,
  RunJournal,
  RunStepCounts,
} from '@runs/application/contracts/run-journal.contract';
import type { RunJournalsPort } from '@runs/application/ports/run-journals.port';
import { isJournalledAttempt } from '@runs/domain/value-objects/run-journalled-attempts';
import {
  CHANGED_PATHS_TYPES,
  ChangedPaths,
} from '@runs/infrastructure/journal/changed-paths';
import { HARNESS_FRAME } from '@runs/infrastructure/journal/harness-events';
import { JournalBuilder } from '@runs/infrastructure/journal/journal-builder';
import { Reported } from '@runs/infrastructure/otel/reported';
import { RunSpecPersistence } from '@runs/infrastructure/persistence/drizzle/run-spec.persistence';
import {
  run,
  runJournalEntry,
} from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import {
  and,
  asc,
  eq,
  inArray,
  ne,
  type SQL,
  sql,
} from 'drizzle-orm';

const idsOf = (runIds: readonly RunId[]): string[] => [
  ...new Set(runIds.map((each) => each.value)),
];

@Injectable()
export class DrizzleRunJournals implements RunJournalsPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async ofRuns(runIds: readonly RunId[]): Promise<RunJournal[]> {
    const ids = idsOf(runIds);

    if (ids.length === 0) {
      return [];
    }

    const journals = await this.readings(ids);

    return [...journals.entries()].map(([at, reading]) => {
      const [runId, attempt] = at.split(':');

      return {
        runId: runId ?? '',
        attempt: Number(attempt ?? 1),
        steps: reading.journal.steps(),
        spans: reading.reported.spans(),
        ms: reading.journal.ms(),
        marks: reading.journal.marks(),
        spent: reading.journal.spent(),
        egressEnforcement: reading.journal.egressEnforcement(),
      };
    });
  }

  async countsOf(
    runIds: readonly RunId[],
  ): Promise<Map<string, RunStepCounts>> {
    const counts = new Map<string, RunStepCounts>();

    for (const journal of await this.ofRuns(runIds)) {
      const before = counts.get(journal.runId) ?? {
        stepCount: 0,
        messageCount: 0,
      };
      const messages = journal.steps.filter(
        (step) => step.kind === 'message',
      ).length;

      counts.set(journal.runId, {
        stepCount: before.stepCount + journal.steps.length - messages,
        messageCount: before.messageCount + messages,
      });
    }

    return counts;
  }

  async changesOf(runIds: readonly RunId[]): Promise<RunChanges[]> {
    const ids = idsOf(runIds);

    if (ids.length === 0) {
      return [];
    }

    const outputs = await this.journalled(
      and(
        inArray(runJournalEntry.runId, ids),
        inArray(runJournalEntry.type, [...CHANGED_PATHS_TYPES]),
      ) as SQL,
      [
        asc(run.createdAt),
        asc(run.id),
        asc(runJournalEntry.attempt),
        asc(runJournalEntry.seq),
      ],
    );
    const changed = new Map<string, ChangedPaths>();
    const checkouts = new Map<string, readonly string[]>();

    for (const row of outputs) {
      const paths = changed.get(row.runId) ?? new ChangedPaths();
      paths.take(row);
      changed.set(row.runId, paths);
      checkouts.set(
        row.runId,
        checkouts.get(row.runId) ??
          RunSpecPersistence.checkoutFoldersIn(row.checkouts),
      );
    }

    return [...changed].flatMap(([runId, paths]) => {
      const taken = paths.paths();

      return taken.length > 0
        ? [{ runId, paths: taken, checkouts: checkouts.get(runId) ?? [] }]
        : [];
    });
  }

  private async readings(ids: string[]) {
    const entries = await this.journalled(
      and(
        inArray(runJournalEntry.runId, ids),
        ne(runJournalEntry.type, HARNESS_FRAME),
      ) as SQL,
      [
        asc(runJournalEntry.runId),
        asc(runJournalEntry.attempt),
        asc(runJournalEntry.seq),
      ],
    );
    const journals = new Map<
      string,
      { journal: JournalBuilder; reported: Reported }
    >();

    for (const row of entries) {
      const at = `${row.runId}:${row.attempt}`;
      const reading = journals.get(at) ?? {
        journal: new JournalBuilder(row.createdAt),
        reported: new Reported(),
      };
      const event = {
        type: row.type,
        at: row.at,
        message: row.message,
        data: row.data,
      };

      reading.journal.take(event);
      reading.reported.take(event);
      journals.set(at, reading);
    }

    return journals;
  }

  private async journalled(which: SQL, order: SQL[]) {
    const rows = await this.db
      .select({
        runId: runJournalEntry.runId,
        attempt: runJournalEntry.attempt,
        type: runJournalEntry.type,
        at: runJournalEntry.at,
        message: runJournalEntry.message,
        data: runJournalEntry.data,
        createdAt: run.createdAt,
        runAttempt: run.attempt,
        suspendedAttempts: run.suspendedAttempts,
        checkouts: sql<unknown>`${run.spec} -> 'checkouts'`,
      })
      .from(runJournalEntry)
      .innerJoin(run, eq(run.id, runJournalEntry.runId))
      .where(which)
      .orderBy(...order);

    return rows.filter((row) =>
      isJournalledAttempt(row.attempt, {
        attempt: row.runAttempt,
        suspendedAttempts: row.suspendedAttempts,
      }),
    );
  }
}
