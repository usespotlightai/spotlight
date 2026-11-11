import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import type { RunStopRequestedQuery } from '@runs/application/queries/run-stop-requested.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RunStopRequestedHandler
  implements QueryHandlerPort<RunStopRequestedQuery, boolean>
{
  constructor(private readonly leases: RunLeasesPort) {}

  async execute(query: RunStopRequestedQuery): Promise<boolean> {
    try {
      const leased = await this.leases.leasedBy(
        RunId.of(query.runId),
        RunnerId.of(query.runnerId),
      );

      return leased?.stopRequested ?? false;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
