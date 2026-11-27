import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
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
import type {
  RunStep,
  StepCommandProposal,
} from '@memory/domain/value-objects/run-step';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const REMEMBERING_STEP = 'remember';

const DEFAULT_SCOPE: MemoryScopeLevel = 'line';

type RememberedStep = Pick<RunStep, 'index' | 'kind' | 'commands'>;

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
  /** What the run's earlier proposals cite of its steps. */
  readonly cited: readonly MemoryProvenance[];
  readonly fromOutside: boolean;
}

interface Carried {
  readonly proposes: Exclude<StepCommandProposal, null>;
  /** The body of the memory, or the reason to retire one. */
  readonly text: string;
}

interface Citation {
  readonly step: number;
  readonly command: number | null;
}

interface Located {
  readonly repository: Repository;
  readonly path: MemoryPath | null;
}

/**
 * The step a proposal came from, and which of its commands made it. That is the latest step with a command of the
 * proposal's kind that no earlier proposal of the run cites and that carried its body or reason exactly, else the
 * first such command of the latest step that has one, as where the body came from stdin; whatever else the step ran
 * first, such as a handover. Where no step shows such a command, the latest remembering step not yet cited is cited
 * whole, or else the run's last step.
 */
const citationOf = (at: RememberedAt, carried: Carried): Citation => {
  const latestFirst = [...at.steps].reverse();
  const open = (step: RememberedStep) =>
    step.commands.flatMap((command, position) =>
      command.proposes === carried.proposes &&
      !at.cited.some((each) => each.cites(step.index, position))
        ? [{ step: step.index, command: position, carrying: command.carrying }]
        : [],
    );
  const candidates = latestFirst.flatMap(open);
  const chosen =
    candidates.find((each) => each.carrying?.trim() === carried.text) ??
    candidates[0];

  if (chosen) {
    return { step: chosen.step, command: chosen.command };
  }

  const step =
    latestFirst.find(
      (each) =>
        each.kind === REMEMBERING_STEP &&
        !at.cited.some((cited) => cited.steps.includes(each.index)),
    ) ?? at.steps[at.steps.length - 1];

  if (!step) {
    throw new InvalidMemoryError(
      'cites a step of its run, and this run has no steps yet',
    );
  }

  return { step: step.index, command: null };
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

    const body = MemoryBody.of(remembered.body);

    return MemoryProposal.of({
      id,
      kind: parseMemoryKind(remembered.kind),
      body,
      scope: scopeOf(remembered, at.runContext),
      provenance: this.provenanceOf(at, {
        proposes: 'memory',
        text: body.value,
      }),
      source: at.fromOutside ? 'outside' : 'run',
      supersedes: supersedes?.id ?? null,
      recordedAt: now,
    });
  }

  retiringOf(input: {
    id: MemoryId;
    memory: Memory;
    because: string;
    at: RememberedAt;
    now: Date;
  }): MemoryProposal {
    const { id, memory, at, now } = input;

    if (!memory.activeOn(at.runContext.teamId, null)) {
      throw new InvalidMemoryError(
        `retires only an active memory in the run's team, and ${memory.handle.value} is not one`,
      );
    }

    return MemoryProposal.retiring({
      id,
      retired: memory,
      reason: input.because,
      provenance: this.provenanceOf(at, {
        proposes: 'retirement',
        text: input.because.trim(),
      }),
      source: at.fromOutside ? 'outside' : 'run',
      recordedAt: now,
    });
  }

  private provenanceOf(at: RememberedAt, carried: Carried): MemoryProvenance {
    const citation = citationOf(at, carried);

    return MemoryProvenance.of({
      taskId: this.taskId,
      runId: this.runId,
      steps: [citation.step],
      notes: [],
      command: citation.command,
    });
  }
}
