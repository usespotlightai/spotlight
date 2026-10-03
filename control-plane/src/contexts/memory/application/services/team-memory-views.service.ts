import type {
  MemoryLinkDto,
  PersonDto,
  TeamMemoryDetailDto,
  TeamMemoryDto,
} from '@memory/application/dto/team-memory.dto';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { PeoplePort, Person } from '@memory/application/ports/people.port';
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
    private readonly uses: MemoryUsesPort,
  ) {}

  async summaries(held: readonly Memory[]): Promise<TeamMemoryDto[]> {
    const people = new Map<string, Person | null>();
    const used = await this.uses.runsUsing(held.map((each) => each.id));

    return Promise.all(held.map((each) => this.summaryOf(each, people, used)));
  }

  async detail(memory: Memory): Promise<TeamMemoryDetailDto> {
    const { grounds } = memory;
    const [summary, steps, notes, superseded, successor] = await Promise.all([
      this.uses
        .runsUsing([memory.id])
        .then((used) => this.summaryOf(memory, new Map(), used)),
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
    people: Map<string, Person | null>,
    used: ReadonlyMap<string, number>,
  ): Promise<TeamMemoryDto> {
    const person = async (id: UserId): Promise<PersonDto> => {
      if (!people.has(id.value)) {
        people.set(id.value, await this.people.find(id));
      }
      const found = people.get(id.value);
      return {
        id: id.value,
        name: found?.name ?? null,
        image: found?.image ?? null,
      };
    };
    const { retirement, grounds, scope } = memory;

    return {
      id: memory.id.value,
      handle: memory.handle.value,
      kind: memory.kind,
      body: memory.body.value,
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
