import type { RunWatchDto } from '@runs/application/dto/run-watch.dto';
import type { RunViewersPort } from '@runs/application/ports/run-viewers.port';
import type { WatchRunQuery } from '@runs/application/queries/watch-run.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class WatchRunHandler
  implements QueryHandlerPort<WatchRunQuery, RunWatchDto | null>
{
  constructor(private readonly runs: RunViewersPort) {}

  async execute(query: WatchRunQuery): Promise<RunWatchDto | null> {
    try {
      const watchable = await this.runs.watchedBy(
        RunId.of(query.runId),
        UserId.of(query.viewerId),
      );

      return watchable ? { attempt: watchable.attempt } : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
