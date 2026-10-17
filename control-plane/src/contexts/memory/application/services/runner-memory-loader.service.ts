import type { LeasedRun, WorkPort } from '@memory/application/ports/work.port';
import type { RecordMemoryUses } from '@memory/application/services/record-memory-uses.service';
import { UnknownRunError } from '@memory/domain/exceptions/unknown-run.error';
import { notAllowedInSearch } from '@memory/domain/services/search-memory-access';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RunnerMemoryLoader {
  constructor(
    private readonly work: WorkPort,
    private readonly recording: RecordMemoryUses,
  ) {}

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

  async recalled(run: LeasedRun, memories: readonly MemoryId[]): Promise<void> {
    if (run.replaysFrom) {
      return;
    }

    await this.recording.recorded(run, 'recalled', memories);
  }
}
