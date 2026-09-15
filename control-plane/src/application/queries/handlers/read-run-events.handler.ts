import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunEventReaderPort } from '@application/ports/run-event-reader.port';
import type { RunEventView } from '@application/ports/run-stream.port';
import type { ReadRunEventsQuery } from '@application/queries/read-run-events.query';
import { RunId } from '@domain/value-objects/run-id.vo';

const MOST_TO_REPLAY_BYTES = 256 * 1024;
const MOST_TO_REPLAY_ENTRIES = 400;

export class ReadRunEventsHandler
  implements QueryHandlerPort<ReadRunEventsQuery, RunEventView[]>
{
  constructor(private readonly events: RunEventReaderPort) {}

  async execute(query: ReadRunEventsQuery): Promise<RunEventView[]> {
    try {
      const found = await this.events.eventsSince(
        RunId.of(query.runId),
        query.attempt,
        Math.max(0, query.afterSeq),
        MOST_TO_REPLAY_ENTRIES,
      );

      return newestWithin(found, MOST_TO_REPLAY_BYTES);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

const newestWithin = (
  events: readonly RunEventView[],
  budget: number,
): RunEventView[] => {
  const kept: RunEventView[] = [];
  let spent = 0;

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    spent += event.data?.length ?? 0;

    if (spent > budget && kept.length > 0) {
      break;
    }

    kept.push(event);
  }

  return kept.reverse();
};
