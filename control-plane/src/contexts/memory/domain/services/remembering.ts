import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { DraftedPlace } from '@memory/domain/services/draft-evidence';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import {
  MEMORY_REACHES,
  type MemoryReach,
} from '@memory/domain/value-objects/memory-reach';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const REMEMBERING_STEP = 'remember';

const UNSAID_REACH: MemoryReach = 'line';

export interface RememberedStep {
  readonly index: number;
  readonly kind: string;
}

export interface Remembered {
  readonly kind: string;
  readonly body: string;
  readonly reach: string | null;
  readonly paths: readonly string[];
  readonly supersedes: Memory | null;
}

interface Located {
  readonly repository: Repository;
  readonly path: MemoryPath | null;
}

export class Remembering {
  private constructor(
    private readonly taskId: TaskId,
    private readonly runId: RunId,
    private readonly place: DraftedPlace,
    private readonly steps: readonly RememberedStep[],
    private readonly cited: ReadonlySet<number>,
    private readonly fromOutside: boolean,
  ) {}

  static of(input: {
    taskId: TaskId;
    runId: RunId;
    place: DraftedPlace;
    steps: readonly RememberedStep[];
    cited: readonly number[];
    fromOutside: boolean;
  }): Remembering {
    return new Remembering(
      input.taskId,
      input.runId,
      input.place,
      input.steps,
      new Set(input.cited),
      input.fromOutside,
    );
  }

  proposalOf(id: MemoryId, remembered: Remembered, now: Date): MemoryProposal {
    const supersedes = remembered.supersedes;

    if (
      supersedes &&
      (supersedes.standing !== 'stands' ||
        !supersedes.scope.teamId.equals(this.place.teamId))
    ) {
      throw new InvalidMemoryError(
        `supersedes only a memory standing in the run's team, and ${supersedes.handle.value} is not one`,
      );
    }

    return MemoryProposal.of({
      id,
      kind: remembered.kind,
      body: remembered.body,
      scope: this.scopeOf(remembered),
      grounds: MemoryGrounds.of({
        taskId: this.taskId,
        runId: this.runId,
        steps: [this.groundingStep()],
        notes: [],
      }),
      source: this.fromOutside ? 'outside' : 'run',
      origin: 'remembered',
      supersedes: supersedes?.id ?? null,
      recordedAt: now,
    });
  }

  private groundingStep(): number {
    const remembering = this.steps.filter(
      (each) => each.kind === REMEMBERING_STEP && !this.cited.has(each.index),
    );
    const step =
      remembering[remembering.length - 1] ?? this.steps[this.steps.length - 1];

    if (!step) {
      throw new InvalidMemoryError(
        'rests on a step of its run, and this run has not said anything yet',
      );
    }

    return step.index;
  }

  private scopeOf(remembered: Remembered): MemoryScope {
    const said = remembered.reach?.trim() || UNSAID_REACH;
    const reach = MEMORY_REACHES.find((each) => each === said);

    if (!reach) {
      throw new InvalidMemoryError(
        `reaches one of ${MEMORY_REACHES.join(', ')}, not ${said}`,
      );
    }

    const located = remembered.paths
      .filter((each) => each.trim())
      .map((each) => this.located(each));
    const repository = located[0]?.repository ?? null;

    if (
      repository &&
      located.some((each) => !each.repository.equals(repository))
    ) {
      throw new InvalidMemoryError(
        'bears on paths of one repository at a time',
      );
    }

    return MemoryScope.of({
      teamId: this.place.teamId,
      lineId: reach === 'team' ? null : this.place.lineId,
      stationId: reach === 'station' ? this.place.stationId : null,
      repository,
      paths: located.flatMap((each) => (each.path ? [each.path] : [])),
    });
  }

  private located(raw: string): Located {
    const [folder, ...rest] = raw
      .replaceAll('\\', '/')
      .split('/')
      .filter(Boolean);
    const matching = this.place.repositories.filter(
      (each) => each.name === folder,
    );
    const [repository] = matching;

    if (!repository || matching.length > 1) {
      throw new InvalidMemoryError(
        `bears only on paths inside a repository its run checked out (${this.checkedOut()}), not ${raw}`,
      );
    }

    return {
      repository,
      path: rest.length > 0 ? MemoryPath.of(rest.join('/')) : null,
    };
  }

  private checkedOut(): string {
    return (
      this.place.repositories.map((each) => each.name).join(', ') || 'none'
    );
  }
}
