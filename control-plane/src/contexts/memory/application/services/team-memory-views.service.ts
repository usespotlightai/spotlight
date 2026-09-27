import type {
  MemoryLinkDto,
  PersonDto,
  TeamMemoryDetailDto,
  TeamMemoryDto,
} from '@memory/application/dto/team-memory.dto';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class TeamMemoryViews {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly work: WorkPort,
    private readonly people: PeoplePort,
  ) {}

  async summaries(held: readonly Memory[]): Promise<TeamMemoryDto[]> {
    const names = new Map<string, string | null>();

    return Promise.all(held.map((each) => this.summaryOf(each, names)));
  }

  async detail(memory: Memory): Promise<TeamMemoryDetailDto> {
    const { grounds } = memory;
    const [summary, steps, notes, superseded, successor] = await Promise.all([
      this.summaryOf(memory, new Map()),
      grounds ? this.work.reasoning(grounds.runId) : null,
      grounds ? this.work.spokenOn(grounds.taskId) : null,
      this.linkTo(memory.supersedes),
      this.linkTo(memory.retirement?.supersededBy ?? null),
    ]);

    return {
      ...summary,
      steps: (steps ?? []).filter((each) =>
        grounds?.steps.includes(each.index),
      ),
      notes: (notes ?? []).filter((each) =>
        grounds?.notes.includes(each.position),
      ),
      superseded,
      successor,
    };
  }

  private async summaryOf(
    memory: Memory,
    names: Map<string, string | null>,
  ): Promise<TeamMemoryDto> {
    const person = async (id: UserId): Promise<PersonDto> => {
      if (!names.has(id.value)) {
        names.set(id.value, await this.people.nameOf(id));
      }
      return { id: id.value, name: names.get(id.value) ?? null };
    };
    const { retirement, grounds, scope } = memory;

    return {
      id: memory.id.value,
      handle: memory.handle.value,
      kind: memory.kind,
      body: memory.body,
      source: memory.source,
      standing: memory.standing,
      reach: scope.reach,
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
      grounds: grounds && {
        taskId: grounds.taskId.value,
        runId: grounds.runId.value,
      },
    };
  }

  private async linkTo(id: MemoryId | null): Promise<MemoryLinkDto | null> {
    const linked = id ? await this.memories.find(id) : null;
    return (
      linked && {
        id: linked.id.value,
        handle: linked.handle.value,
        body: linked.body,
      }
    );
  }
}
