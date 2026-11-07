import type { RunJournalEntryReaderPort } from '@runs/application/ports/run-journal-entry-reader.port';
import type { RunEventView } from '@runs/application/ports/run-stream.port';
import type { RunViewersPort } from '@runs/application/ports/run-viewers.port';
import type { ReadRunEventsQuery } from '@runs/application/queries/read-run-events.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const MAX_TO_REPLAY_BYTES = 256 * 1024;
const MAX_TO_REPLAY_ENTRIES = 400;

export class ReadRunEventsHandler
  implements QueryHandlerPort<ReadRunEventsQuery, RunEventView[]>
{
  constructor(
    private readonly runs: RunViewersPort,
    private readonly events: RunJournalEntryReaderPort,
  ) {}

  async execute(query: ReadRunEventsQuery): Promise<RunEventView[]> {
    try {
      const runId = RunId.of(query.runId);

      if (!(await this.runs.watchedBy(runId, UserId.of(query.viewerId)))) {
        return [];
      }

      const found = await this.events.eventsSince(
        runId,
        query.attempt,
        Math.max(0, query.afterSeq),
        MAX_TO_REPLAY_ENTRIES,
      );

      return newestWithin(found, MAX_TO_REPLAY_BYTES);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

const newestWithin = (
  events: readonly RunEventView[],
  budget: number,
): RunEventView[] => {
  const newest: RunEventView[] = [];
  let spent = 0;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    spent += event.data?.length ?? 0;

    if (spent > budget && newest.length > 0) {
      break;
    }

    newest.push(event);
  }

  return newest.reverse();
};
