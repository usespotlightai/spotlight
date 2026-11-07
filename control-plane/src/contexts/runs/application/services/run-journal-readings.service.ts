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
import type { RunJournalReadingsPort } from '@runs/application/ports/run-journal-readings.port';
import { fileChangesOf } from '@runs/application/read-models/file-changes';
import { lastWordsIn } from '@runs/application/read-models/last-words';
import { tracedRunsOf, traceOf } from '@runs/application/read-models/run-trace';
import { hunksOf } from '@runs/domain/services/change-hunks';
import {
  workingCopyPath,
  workingCopyPathsIn,
} from '@runs/domain/services/working-copy-path';

export class RunJournalReadings implements RunJournalReadingsPort {
  traceOf(
    runs: readonly RunToTrace[],
    journals: readonly RunJournal[],
    connections: readonly ConnectionOfRun[],
  ): Trace {
    return traceOf(tracedRunsOf(runs, journals, connections));
  }

  fileChangesOf(journal: RunJournal): readonly FileChange[] {
    return fileChangesOf(journal);
  }

  lastWordsIn(
    attempts: readonly RunJournal[],
    since: Date | null,
  ): string | null {
    return lastWordsIn(attempts, since);
  }

  workingCopyPathsIn(changes: RunChanges): readonly string[] {
    return workingCopyPathsIn(changes);
  }

  hunksIn(
    steps: readonly JournalStep[],
    checkouts: readonly string[],
  ): readonly ChangeHunk[] {
    const order: string[] = [];
    const first = new Map<string, string>();
    const last = new Map<string, string>();

    for (const step of steps) {
      const change = step.change;

      if (!change?.path) {
        continue;
      }

      if (!first.has(change.path)) {
        first.set(change.path, change.before);
        order.push(change.path);
      }

      last.set(change.path, change.after);
    }

    return order.flatMap((path) =>
      hunksOf(
        workingCopyPath(path, checkouts) ?? path,
        first.get(path) ?? '',
        last.get(path) ?? '',
      ),
    );
  }
}
