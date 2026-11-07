import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  RunChanges,
  RunJournal,
} from '@work/application/contracts/run-journal.contract';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import type { RunJournalsPort } from '@work/application/ports/run-journals.port';
import { isJournalledAttempt } from '@work/domain/value-objects/run-journalled-attempts';
import { ChangedPaths } from '@work/infrastructure/acp/changed-paths';
import { JournalBuilder } from '@work/infrastructure/acp/journal-builder';
import { Reported } from '@work/infrastructure/otel/reported';
import {
  run,
  runJournalEntry,
} from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
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

    const entries = await this.journalled(inArray(runJournalEntry.runId, ids), [
      asc(runJournalEntry.runId),
      asc(runJournalEntry.attempt),
      asc(runJournalEntry.seq),
    ]);
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

  async changesOf(runIds: readonly RunId[]): Promise<RunChanges[]> {
    const ids = idsOf(runIds);

    if (ids.length === 0) {
      return [];
    }

    const outputs = await this.journalled(
      and(
        inArray(runJournalEntry.runId, ids),
        eq(runJournalEntry.type, 'output'),
        isNull(runJournalEntry.message),
        isNotNull(runJournalEntry.data),
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
      paths.take(row.data ?? '');
      changed.set(row.runId, paths);
      checkouts.set(
        row.runId,
        checkouts.get(row.runId) ??
          RunSpecContract.checkoutFoldersIn(row.checkouts),
      );
    }

    return [...changed].flatMap(([runId, paths]) => {
      const taken = paths.paths();

      return taken.length > 0
        ? [{ runId, paths: taken, checkouts: checkouts.get(runId) ?? [] }]
        : [];
    });
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
