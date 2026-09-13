import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunStopRequestedQuery } from '@application/queries/run-stop-requested.query';
import type { RunRepository } from '@domain/repositories/run.repository';
import { RunId } from '@domain/value-objects/run-id.vo';

export class RunStopRequestedHandler
  implements QueryHandlerPort<RunStopRequestedQuery, boolean>
{
  constructor(private readonly runs: RunRepository) {}

  async execute(query: RunStopRequestedQuery): Promise<boolean> {
    try {
      const run = await this.runs.findById(RunId.of(query.runId));

      return run?.stopRequested ?? false;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
