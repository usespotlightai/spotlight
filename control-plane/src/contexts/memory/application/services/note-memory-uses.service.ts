import type { WorkPort } from '@memory/application/ports/work.port';
import type {
  RecordMemoryUses,
  UsingRun,
} from '@memory/application/services/record-memory-uses.service';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import {
  handlesRead,
  MEMORY_FILE,
  MEMORY_FOLDER,
} from '@memory/domain/services/memory-folder';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';

export class NoteMemoryUses {
  constructor(
    private readonly recording: RecordMemoryUses,
    private readonly work: WorkPort,
    private readonly memories: MemoryRepository,
  ) {}

  runBriefed(run: UsingRun, memories: readonly string[]): Promise<void> {
    return this.recording.recorded(
      run,
      'briefed',
      memories.map((each) => MemoryId.of(each)),
    );
  }

  async runEnded(run: UsingRun): Promise<void> {
    const site = await this.work.siteOfRun(run.id);
    const referenced = await this.work.referencedUnder(
      run.id,
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

    await this.recording.recorded(
      run,
      'recalled',
      read.map((each) => each.id),
    );
  }
}
