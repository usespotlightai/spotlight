import type { RunWatchDto } from '@application/dto/run-watch.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunEventReaderPort } from '@application/ports/run-event-reader.port';
import type { WatchRunQuery } from '@application/queries/watch-run.query';
import { RunId } from '@domain/value-objects/run-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class WatchRunHandler
  implements QueryHandlerPort<WatchRunQuery, RunWatchDto | null>
{
  constructor(private readonly events: RunEventReaderPort) {}

  async execute(query: WatchRunQuery): Promise<RunWatchDto | null> {
    try {
      const watchable = await this.events.findForViewer(
        RunId.of(query.runId),
        UserId.of(query.viewerId),
      );

      return watchable ? { attempt: watchable.attempt } : null;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
