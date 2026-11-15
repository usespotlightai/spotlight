import type { RecalledMemoryDto } from '@memory/application/dto/recalled-memory.dto';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import { lookUpOnce } from '@memory/application/services/people-lookup';
import { provenanceNotes } from '@memory/application/services/provenance-notes';
import type { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';

export class RecalledMemoryViews {
  constructor(
    private readonly views: TeamMemoryViews,
    private readonly work: WorkPort,
    private readonly people: PeoplePort,
  ) {}

  async recalled(memory: Memory): Promise<RecalledMemoryDto> {
    const { provenance } = memory;
    const person = lookUpOnce(this.people);
    const [detail, steps, notes] = await Promise.all([
      this.views.detail(memory, person),
      provenance ? this.work.reasoning(provenance.runId) : null,
      provenance ? this.work.notesOf(provenance.taskId) : null,
    ]);

    return {
      ...detail,
      steps: (steps ?? []).filter((each) =>
        provenance?.steps.includes(each.index),
      ),
      notes: await provenanceNotes(
        notes ?? [],
        provenance?.notes ?? [],
        person,
      ),
    };
  }
}
