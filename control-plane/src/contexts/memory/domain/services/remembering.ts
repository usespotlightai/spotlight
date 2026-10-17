import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { KeptFromReplaysError } from '@memory/domain/exceptions/kept-from-replays.error';
import { keptFromSearches } from '@memory/domain/services/search-reach';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { parseMemoryKind } from '@memory/domain/value-objects/memory-kind';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import {
  type MemoryReach,
  parseMemoryReach,
} from '@memory/domain/value-objects/memory-reach';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { StationSite } from '@memory/domain/value-objects/run-site';
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

export interface RememberedAt {
  readonly site: StationSite;
  readonly steps: readonly RememberedStep[];
  readonly cited: readonly number[];
  readonly fromOutside: boolean;
}

interface Located {
  readonly repository: Repository;
  readonly path: MemoryPath | null;
}

const groundingStep = (at: RememberedAt): number => {
  const cited = new Set(at.cited);
  const remembering = at.steps.filter(
    (each) => each.kind === REMEMBERING_STEP && !cited.has(each.index),
  );
  const step =
    remembering[remembering.length - 1] ?? at.steps[at.steps.length - 1];

  if (!step) {
    throw new InvalidMemoryError(
      'rests on a step of its run, and this run has no steps yet',
    );
  }

  return step.index;
};

const checkedOut = (site: StationSite): string =>
  site.repositories.map((each) => each.name).join(', ') || 'none';

const located = (raw: string, site: StationSite): Located => {
  const [folder, ...rest] = raw
    .replaceAll('\\', '/')
    .split('/')
    .filter(Boolean);
  const matching = site.repositories.filter((each) => each.name === folder);
  const [repository] = matching;

  if (!repository || matching.length > 1) {
    throw new InvalidMemoryError(
      `bears only on paths inside a repository its run checked out (${checkedOut(site)}), not ${raw}`,
    );
  }

  return {
    repository,
    path: rest.length > 0 ? MemoryPath.of(rest.join('/')) : null,
  };
};

const scopeOf = (remembered: Remembered, site: StationSite): MemoryScope => {
  const reach = parseMemoryReach(remembered.reach?.trim() || UNSAID_REACH);
  const places = remembered.paths
    .filter((each) => each.trim())
    .map((each) => located(each, site));
  const repository = places[0]?.repository ?? null;

  if (
    repository &&
    places.some((each) => !each.repository.equals(repository))
  ) {
    throw new InvalidMemoryError('bears on paths of one repository at a time');
  }

  return MemoryScope.of({
    teamId: site.teamId,
    lineId: reach === 'team' ? null : site.lineId,
    stationId: reach === 'station' ? site.stationId : null,
    repository,
    paths: places.flatMap((each) => (each.path ? [each.path] : [])),
  });
};

export class Remembering {
  private constructor(
    readonly taskId: TaskId,
    private readonly runId: RunId,
  ) {}

  static of(input: {
    taskId: TaskId | null;
    runId: RunId;
    replay: boolean;
    isSearch: boolean;
  }): Remembering {
    keptFromSearches(input, 'remember anything for the team');

    if (input.replay) {
      throw new KeptFromReplaysError('remember anything for the team');
    }

    if (!input.taskId) {
      throw new InvalidMemoryError(
        "is remembered only from a task's run; in a chat, ask the person to write it on the team's Memory page",
      );
    }

    return new Remembering(input.taskId, input.runId);
  }

  proposalOf(input: {
    id: MemoryId;
    remembered: Remembered;
    at: RememberedAt;
    now: Date;
  }): MemoryProposal {
    const { id, remembered, at, now } = input;
    const supersedes = remembered.supersedes;

    if (
      supersedes &&
      (!supersedes.isActive || !supersedes.scope.teamId.equals(at.site.teamId))
    ) {
      throw new InvalidMemoryError(
        `supersedes only an active memory in the run's team, and ${supersedes.handle.value} is not one`,
      );
    }

    return MemoryProposal.of({
      id,
      kind: parseMemoryKind(remembered.kind),
      body: MemoryBody.of(remembered.body),
      scope: scopeOf(remembered, at.site),
      grounds: MemoryGrounds.of({
        taskId: this.taskId,
        runId: this.runId,
        steps: [groundingStep(at)],
        notes: [],
      }),
      source: at.fromOutside ? 'outside' : 'run',
      origin: 'remembered',
      supersedes: supersedes?.id ?? null,
      recordedAt: now,
    });
  }
}
