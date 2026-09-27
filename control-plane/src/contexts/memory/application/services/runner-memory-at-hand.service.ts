import type { HeldRun, WorkPort } from '@memory/application/ports/work.port';
import { UnknownRunError } from '@memory/domain/exceptions/unknown-run.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RunnerMemoryAtHand {
  constructor(private readonly work: WorkPort) {}

  async held(runId: string, runnerId: string): Promise<HeldRun> {
    const held = await this.work.heldBy(RunId.of(runId), RunnerId.of(runnerId));

    if (!held) {
      throw new UnknownRunError(runId);
    }

    return held;
  }
}
