import type { RunJournalEntryReaderPort } from '@runs/application/ports/run-journal-entry-reader.port';
import type {
  RunJournalEntryView,
  RunStreamPort,
} from '@runs/application/ports/run-stream.port';
import type { RunViewing } from '@runs/application/services/run-viewing.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const MAX_TO_REPLAY_BYTES = 256 * 1024;
const MAX_TO_REPLAY_ENTRIES = 400;

export interface JournalPosition {
  readonly attempt: number;
  readonly seq: number;
}

export interface RunWatch {
  readonly attempt: number;

  follow(
    from: JournalPosition,
    listener: (entry: RunJournalEntryView) => void,
    failed: (error: unknown) => void,
  ): () => void;
}

export const newestWithin = (
  entries: readonly RunJournalEntryView[],
  budget: number,
): RunJournalEntryView[] => {
  const newest: RunJournalEntryView[] = [];
  let spent = 0;

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    spent += entry.data?.length ?? 0;

    if (spent > budget && newest.length > 0) {
      break;
    }

    newest.push(entry);
  }

  return newest.reverse();
};

export class WatchRunStream {
  constructor(
    private readonly runs: RunViewing,
    private readonly entries: RunJournalEntryReaderPort,
    private readonly stream: RunStreamPort,
  ) {}

  async open(runId: string, viewerId: string): Promise<RunWatch | null> {
    try {
      const run = RunId.of(runId);
      const watched = await this.runs.watchedBy(run, UserId.of(viewerId));

      return watched
        ? {
            attempt: watched.attempt,
            follow: (from, listener, failed) =>
              this.follow(run, from, listener, failed),
          }
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private follow(
    runId: RunId,
    from: JournalPosition,
    listener: (entry: RunJournalEntryView) => void,
    failed: (error: unknown) => void,
  ): () => void {
    let buffered: RunJournalEntryView[] = [];
    let replaying = true;

    // Subscribe before you read the backlog, so that no entry is lost between the two.
    const detach = this.stream.subscribe(runId.value, (entry) => {
      if (replaying) {
        buffered.push(entry);
        return;
      }
      listener(entry);
    });

    this.entries
      .entriesSince(
        runId,
        from.attempt,
        Math.max(0, from.seq),
        MAX_TO_REPLAY_ENTRIES,
      )
      .then((found) => {
        for (const entry of newestWithin(found, MAX_TO_REPLAY_BYTES)) {
          listener(entry);
        }

        replaying = false;
        for (const entry of buffered) {
          listener(entry);
        }
        buffered = [];
      })
      .catch(failed);

    return () => {
      detach();
      buffered = [];
    };
  }
}
