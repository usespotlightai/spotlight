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
import {
  fileChangesOf,
  netHunksOf,
} from '@runs/application/read-models/file-changes';
import { lastWordsIn } from '@runs/application/read-models/last-words';
import { tracedRunsOf, traceOf } from '@runs/application/read-models/run-trace';
import { workingCopyPathsIn } from '@runs/domain/services/working-copy-path';

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
    return netHunksOf(steps, checkouts);
  }
}
