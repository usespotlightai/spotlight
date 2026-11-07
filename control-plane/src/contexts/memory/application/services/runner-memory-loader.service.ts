import type { LeasedRun, WorkPort } from '@memory/application/ports/work.port';
import { UnknownRunError } from '@memory/domain/exceptions/unknown-run.error';
import { notAllowedInSearch } from '@memory/domain/services/search-memory-access';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RunnerMemoryLoader {
  constructor(private readonly work: WorkPort) {}

  async leased(runId: string, runnerId: string): Promise<LeasedRun> {
    const run = await this.work.leasedBy(
      RunId.of(runId),
      RunnerId.of(runnerId),
    );

    if (!run) {
      throw new UnknownRunError(runId);
    }

    return run;
  }

  async recalling(runId: string, runnerId: string): Promise<LeasedRun> {
    const run = await this.leased(runId, runnerId);

    notAllowedInSearch(run, 'recall what the team remembers');

    return run;
  }
}
