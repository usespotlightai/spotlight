import type {
  MemoryLinkDto,
  TeamMemoryDetailDto,
  TeamMemoryDto,
} from '@memory/application/dto/team-memory.dto';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import {
  lookUpOnce,
  type PersonLookup,
} from '@memory/application/services/people-lookup';
import { provenanceNotes } from '@memory/application/services/provenance-notes';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';

export class TeamMemoryViews {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly work: WorkPort,
    private readonly people: PeoplePort,
    private readonly uses: MemoryUsesPort,
  ) {}

  async summaries(memories: readonly Memory[]): Promise<TeamMemoryDto[]> {
    const person = lookUpOnce(this.people);
    const used = await this.uses.runsUsing(memories.map((each) => each.id));

    return Promise.all(
      memories.map((each) => this.summaryOf(each, person, used)),
    );
  }

  async detail(memory: Memory): Promise<TeamMemoryDetailDto> {
    const { provenance } = memory;
    const person = lookUpOnce(this.people);
    const [summary, steps, notes, harness, superseded, successor] =
      await Promise.all([
        this.uses
          .runsUsing([memory.id])
          .then((used) => this.summaryOf(memory, person, used)),
        provenance ? this.work.reasoning(provenance.runId) : null,
        provenance ? this.work.notesOf(provenance.taskId) : null,
        provenance ? this.work.harnessOf(provenance.runId) : null,
        this.linkTo(memory.supersedes),
        this.linkTo(memory.retirement?.supersededBy ?? null),
      ]);

    return {
      ...summary,
      harness,
      steps: (steps ?? []).filter((each) =>
        provenance?.steps.includes(each.index),
      ),
      notes: await provenanceNotes(
        notes ?? [],
        provenance?.notes ?? [],
        person,
      ),
      superseded,
      successor,
    };
  }

  private async summaryOf(
    memory: Memory,
    person: PersonLookup,
    used: ReadonlyMap<string, number>,
  ): Promise<TeamMemoryDto> {
    const { retirement, provenance, scope } = memory;

    return {
      id: memory.id.value,
      handle: memory.handle.value,
      kind: memory.kind,
      body: memory.body.value,
      source: memory.source,
      status: memory.status,
      scope: scope.level,
      lineId: scope.lineId,
      stationId: scope.stationId,
      repository: scope.repository?.value ?? null,
      paths: scope.paths.map((each) => each.value),
      approvedBy: await person(memory.approval.by),
      approvedAt: memory.approval.at.toISOString(),
      supersedes: memory.supersedes?.value ?? null,
      retirement: retirement && {
        at: retirement.at.toISOString(),
        by: retirement.by ? await person(retirement.by) : null,
        reason: retirement.reason,
        supersededBy: retirement.supersededBy?.value ?? null,
      },
      provenance: provenance && {
        taskId: provenance.taskId.value,
        runId: provenance.runId.value,
      },
      runs: used.get(memory.id.value) ?? 0,
    };
  }

  private async linkTo(id: MemoryId | null): Promise<MemoryLinkDto | null> {
    const linked = id ? await this.memories.find(id) : null;
    return (
      linked && {
        id: linked.id.value,
        handle: linked.handle.value,
        body: linked.body.value,
      }
    );
  }
}
