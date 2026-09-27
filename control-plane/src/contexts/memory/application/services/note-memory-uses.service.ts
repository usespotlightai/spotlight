import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class NoteMemoryUses {
  constructor(
    private readonly uses: MemoryUsesPort,
    private readonly clock: ClockPort,
  ) {}

  runBriefed(runId: RunId, memories: readonly string[]): Promise<void> {
    return this.uses.record(
      runId,
      'briefed',
      memories.map((each) => MemoryId.of(each)),
      this.clock.now(),
    );
  }
}
