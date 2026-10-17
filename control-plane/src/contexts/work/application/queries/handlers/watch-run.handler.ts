import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunWatchDto } from '@work/application/dto/run-watch.dto';
import type { RunEventReaderPort } from '@work/application/ports/run-event-reader.port';
import type { WatchRunQuery } from '@work/application/queries/watch-run.query';

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
      rethrowAsApplicationError(error);
    }
  }
}
