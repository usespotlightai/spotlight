import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import {
  handlesRead,
  MEMORY_FILE,
  MEMORY_FOLDER,
} from '@memory/domain/services/memory-folder';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class NoteMemoryUses {
  constructor(
    private readonly uses: MemoryUsesPort,
    private readonly work: WorkPort,
    private readonly memories: MemoryRepository,
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

  async runEnded(runId: RunId): Promise<void> {
    const site = await this.work.siteOfRun(runId);
    const referenced = await this.work.referencedUnder(
      runId,
      MEMORY_FOLDER,
      MEMORY_FILE,
    );
    const handles = handlesRead(referenced ?? []);

    if (!site || handles.length === 0) {
      return;
    }

    const read = (await this.memories.withHandles(site.teamId, handles)).filter(
      (each) => each.appliesAt(site),
    );

    await this.uses.record(
      runId,
      'recalled',
      read.map((each) => each.id),
      this.clock.now(),
    );
  }
}
