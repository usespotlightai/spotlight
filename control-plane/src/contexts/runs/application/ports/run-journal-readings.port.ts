import type {
  ChangeHunk,
  FileChange,
  JournalStep,
  RunChanges,
  RunJournal,
} from '@runs/application/contracts/run-journal.contract';
import type {
  RunToTrace,
  Trace,
} from '@runs/application/contracts/run-trace.contract';
import type { ConnectionOfRun } from '@runs/application/ports/run-connections.port';

export const RUN_JOURNAL_READINGS = Symbol('RUN_JOURNAL_READINGS');

export interface RunJournalReadingsPort {
  traceOf(
    runs: readonly RunToTrace[],
    journals: readonly RunJournal[],
    connections: readonly ConnectionOfRun[],
  ): Trace;

  fileChangesOf(journal: RunJournal): readonly FileChange[];

  lastWordsIn(
    attempts: readonly RunJournal[],
    since: Date | null,
  ): string | null;

  workspacePathsIn(changes: RunChanges): readonly string[];

  hunksIn(
    steps: readonly JournalStep[],
    checkouts: readonly string[],
  ): readonly ChangeHunk[];
}
