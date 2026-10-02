import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { HeldRun, WorkPort } from '@memory/application/ports/work.port';
import { UnknownRunError } from '@memory/domain/exceptions/unknown-run.error';
import { keptFromSearches } from '@memory/domain/services/search-reach';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RunnerMemoryAtHand {
  constructor(
    private readonly work: WorkPort,
    private readonly uses: MemoryUsesPort,
    private readonly clock: ClockPort,
  ) {}

  async held(runId: string, runnerId: string): Promise<HeldRun> {
    const held = await this.work.heldBy(RunId.of(runId), RunnerId.of(runnerId));

    if (!held) {
      throw new UnknownRunError(runId);
    }

    return held;
  }

  async recalling(runId: string, runnerId: string): Promise<HeldRun> {
    const held = await this.held(runId, runnerId);

    keptFromSearches(held, 'recall what the team remembers');

    return held;
  }

  async recalled(held: HeldRun, memories: readonly MemoryId[]): Promise<void> {
    if (held.replaysFrom) {
      return;
    }

    await this.uses.record(held.id, 'recalled', memories, this.clock.now());
  }
}
