import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { NotAllowedAsOfPastTimeError } from '@memory/domain/exceptions/not-allowed-as-of-past-time.error';
import { notAllowedWithoutMemories } from '@memory/domain/services/run-memory-use';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { parseMemoryKind } from '@memory/domain/value-objects/memory-kind';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import type { MemoryPredecessor } from '@memory/domain/value-objects/memory-predecessor.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import {
  type MemoryScopeLevel,
  parseMemoryScopeLevel,
} from '@memory/domain/value-objects/memory-scope-level';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { StationContext } from '@memory/domain/value-objects/run-context';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const REMEMBERING_STEP = 'remember';

const DEFAULT_SCOPE: MemoryScopeLevel = 'line';

export interface RememberedStep {
  readonly index: number;
  readonly kind: string;
}

export interface Remembered {
  readonly kind: string;
  readonly body: string;
  readonly scope: string | null;
  readonly paths: readonly string[];
  readonly supersedes: MemoryPredecessor | null;
}

export interface RememberedAt {
  readonly runContext: StationContext;
  readonly steps: readonly RememberedStep[];
  readonly cited: readonly number[];
  readonly fromOutside: boolean;
}

interface Located {
  readonly repository: Repository;
  readonly path: MemoryPath | null;
}

const citedStep = (at: RememberedAt): number => {
  const cited = new Set(at.cited);
  const remembering = at.steps.filter(
    (each) => each.kind === REMEMBERING_STEP && !cited.has(each.index),
  );
  const step =
    remembering[remembering.length - 1] ?? at.steps[at.steps.length - 1];

  if (!step) {
    throw new InvalidMemoryError(
      'cites a step of its run, and this run has no steps yet',
    );
  }

  return step.index;
};

const checkedOut = (runContext: StationContext): string =>
  runContext.repositories.map((each) => each.name).join(', ') || 'none';

const located = (raw: string, runContext: StationContext): Located => {
  const [folder, ...rest] = raw
    .replaceAll('\\', '/')
    .split('/')
    .filter(Boolean);
  const matching = runContext.repositories.filter(
    (each) => each.name === folder,
  );
  const [repository] = matching;

  if (!repository || matching.length > 1) {
    throw new InvalidMemoryError(
      `is only about paths inside a repository its run checked out (${checkedOut(runContext)}), not ${raw}`,
    );
  }

  return {
    repository,
    path: rest.length > 0 ? MemoryPath.of(rest.join('/')) : null,
  };
};

const scopeOf = (
  remembered: Remembered,
  runContext: StationContext,
): MemoryScope => {
  const level = parseMemoryScopeLevel(
    remembered.scope?.trim() || DEFAULT_SCOPE,
  );
  const places = remembered.paths
    .filter((each) => each.trim())
    .map((each) => located(each, runContext));
  const repository = places[0]?.repository ?? null;

  if (
    repository &&
    places.some((each) => !each.repository.equals(repository))
  ) {
    throw new InvalidMemoryError('is about paths of one repository at a time');
  }

  return MemoryScope.of({
    teamId: runContext.teamId,
    lineId: level === 'team' ? null : runContext.lineId,
    stationId: level === 'station' ? runContext.stationId : null,
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
    asOf: Date | null;
    isolated: boolean;
    trial: boolean;
  }): Remembering {
    notAllowedWithoutMemories(input, 'remember anything for the team');

    if (input.asOf !== null) {
      throw new NotAllowedAsOfPastTimeError('remember anything for the team');
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

    if (supersedes && !supersedes.supersedableIn(at.runContext.teamId)) {
      throw new InvalidMemoryError(
        `supersedes only an active memory in the run's team, and ${supersedes.handle.value} is not one`,
      );
    }

    return MemoryProposal.of({
      id,
      kind: parseMemoryKind(remembered.kind),
      body: MemoryBody.of(remembered.body),
      scope: scopeOf(remembered, at.runContext),
      provenance: MemoryProvenance.of({
        taskId: this.taskId,
        runId: this.runId,
        steps: [citedStep(at)],
        notes: [],
      }),
      source: at.fromOutside ? 'outside' : 'run',
      proposedBy: 'agent',
      supersedes: supersedes?.id ?? null,
      recordedAt: now,
    });
  }
}
