import type { LeasedRun, WorkPort } from '@memory/application/ports/work.port';
import { UnknownRunError } from '@memory/domain/exceptions/unknown-run.error';
import { notAllowedInSearch } from '@memory/domain/services/search-memory-access';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RunnerMemoryLoader {
  constructor(private readonly work: WorkPort) {}

  async leased(runId: RunId, runnerId: RunnerId): Promise<LeasedRun> {
    const run = await this.work.leasedBy(runId, runnerId);

    if (!run) {
      throw new UnknownRunError(runId.value);
    }

    return run;
  }

  async recalling(runId: RunId, runnerId: RunnerId): Promise<LeasedRun> {
    const run = await this.leased(runId, runnerId);

    notAllowedInSearch(run, 'recall what the team remembers');

    return run;
  }
}
