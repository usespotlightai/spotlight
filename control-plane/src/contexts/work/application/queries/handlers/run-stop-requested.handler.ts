import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { LeasedRunReaderPort } from '@work/application/ports/leased-run-reader.port';
import type { RunStopRequestedQuery } from '@work/application/queries/run-stop-requested.query';

export class RunStopRequestedHandler
  implements QueryHandlerPort<RunStopRequestedQuery, boolean>
{
  constructor(private readonly leasedRuns: LeasedRunReaderPort) {}

  async execute(query: RunStopRequestedQuery): Promise<boolean> {
    try {
      return await this.leasedRuns.stopRequestedFor(
        RunId.of(query.runId),
        RunnerId.of(query.runnerId),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
