import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import {
  MemoryProposal,
  type ProposedMemory,
} from '@memory/domain/entities/memory-proposal.entity';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { parseMemoryKind } from '@memory/domain/value-objects/memory-kind';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { parseMemoryReach } from '@memory/domain/value-objects/memory-reach';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { MemorySource } from '@memory/domain/value-objects/memory-source';
import type { StationSite } from '@memory/domain/value-objects/run-site';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const MOST_TOLD = 2_000;

const MOST_STEPS_TOLD = 100_000;

const MOST_NOTES_TOLD = 20_000;

const MOST_STANDING_TOLD = 50;

export type NoteSpeaker = 'person' | 'world';

export interface EvidenceStep {
  readonly index: number;
  readonly kind: string;
  readonly text: string;
}

export interface EvidenceNote {
  readonly position: number;
  readonly by: NoteSpeaker;
  readonly text: string;
}

export interface ChangedPath {
  readonly repository: Repository;
  readonly path: string;
}

const clipped = (text: string): string => {
  const trimmed = text.trim();
  return trimmed.length > MOST_TOLD
    ? `${trimmed.slice(0, MOST_TOLD)} …`
    : trimmed;
};

const within = <T extends { readonly text: string }>(
  items: readonly T[],
  most: number,
): T[] => {
  const kept: T[] = [];
  let used = 0;

  for (const item of items) {
    if (used + item.text.length > most) {
      break;
    }

    kept.push(item);
    used += item.text.length;
  }

  return kept;
};

const pathOf = (raw: string): MemoryPath | null => {
  try {
    return MemoryPath.of(raw);
  } catch (error) {
    if (error instanceof InvalidMemoryError) {
      return null;
    }
    throw error;
  }
};

const changeKey = (repository: string, path: MemoryPath): string =>
  `${repository}:${path.value}`;

export class DraftEvidence {
  private constructor(
    private readonly taskId: TaskId,
    private readonly runId: RunId,
    private readonly site: StationSite,
    readonly steps: readonly EvidenceStep[],
    readonly stepsLeftOut: number,
    readonly notes: readonly EvidenceNote[],
    readonly changed: readonly ChangedPath[],
    private readonly changedKeys: ReadonlySet<string>,
    readonly standing: readonly Memory[],
    private readonly fromOutside: boolean,
  ) {}

  static of(input: {
    taskId: TaskId;
    runId: RunId;
    site: StationSite;
    steps: readonly EvidenceStep[];
    notes: readonly EvidenceNote[];
    notesRead: number;
    changed: readonly ChangedPath[];
    known: readonly Memory[];
    fromOutside: boolean;
  }): DraftEvidence {
    const steps = within(
      input.steps
        .map((each) => ({ ...each, text: clipped(each.text) }))
        .reverse(),
      MOST_STEPS_TOLD,
    ).reverse();
    const ordered = [...input.notes]
      .sort((a, b) => a.position - b.position)
      .map((each) => ({ ...each, text: clipped(each.text) }));
    const unread = within(
      ordered.filter((each) => each.position >= input.notesRead),
      MOST_NOTES_TOLD,
    );
    const revisited = within(
      ordered.filter((each) => each.position < input.notesRead),
      MOST_NOTES_TOLD - unread.reduce((sum, each) => sum + each.text.length, 0),
    );
    const changed = input.changed.flatMap((each) => {
      const path = pathOf(each.path);
      return path
        ? [{ each, key: changeKey(each.repository.value, path) }]
        : [];
    });

    const standing = input.known
      .filter((each) => each.appliesAt(input.site))
      .sort(
        (one, other) => other.approval.at.getTime() - one.approval.at.getTime(),
      )
      .slice(0, MOST_STANDING_TOLD);

    return new DraftEvidence(
      input.taskId,
      input.runId,
      input.site,
      steps,
      input.steps.length - steps.length,
      [...revisited, ...unread],
      changed.map(({ each }) => each),
      new Set(changed.map(({ key }) => key)),
      standing,
      input.fromOutside,
    );
  }

  get isEmpty(): boolean {
    return this.steps.length === 0 && this.notes.length === 0;
  }

  get notesThrough(): number | null {
    return this.notes.length > 0
      ? Math.max(...this.notes.map((each) => each.position))
      : null;
  }

  isFor(taskId: TaskId, runId: RunId): boolean {
    return this.taskId.equals(taskId) && this.runId.equals(runId);
  }

  proposalOf(
    id: MemoryId,
    proposed: ProposedMemory,
    now: Date,
  ): MemoryProposal {
    const grounds = MemoryGrounds.of({
      taskId: this.taskId,
      runId: this.runId,
      steps: proposed.steps,
      notes: proposed.notes,
    });

    if (
      !grounds.steps.every((index) =>
        this.steps.some((each) => each.index === index),
      )
    ) {
      throw new InvalidMemoryError(
        'cites only steps of its run that its drafter read',
      );
    }

    if (!grounds.notes.every((position) => this.speakerOf(position))) {
      throw new InvalidMemoryError('cites only notes its drafter read');
    }

    const supersedes = proposed.supersedes?.trim()
      ? MemoryId.of(proposed.supersedes.trim())
      : null;

    if (
      supersedes &&
      !this.standing.some((each) => each.id.equals(supersedes))
    ) {
      throw new InvalidMemoryError(
        'supersedes only a memory standing in scope',
      );
    }

    return MemoryProposal.of({
      id,
      kind: parseMemoryKind(proposed.kind),
      body: MemoryBody.of(proposed.body),
      scope: this.scopeOf(proposed),
      grounds,
      source: this.sourceOf(grounds),
      origin: 'drafted',
      supersedes,
      recordedAt: now,
    });
  }

  private speakerOf(position: number): NoteSpeaker | null {
    return this.notes.find((each) => each.position === position)?.by ?? null;
  }

  private scopeOf(proposed: ProposedMemory): MemoryScope {
    const reach = parseMemoryReach(proposed.reach);
    const named = proposed.repository?.trim() || null;
    const repository = named
      ? this.site.repositories.find((each) => each.value === named)
      : null;

    if (named && !repository) {
      throw new InvalidMemoryError('names only a repository its run worked in');
    }

    const paths = proposed.paths
      .filter((each) => each.trim())
      .map(MemoryPath.of);
    if (
      repository &&
      !paths.every((each) =>
        this.changedKeys.has(changeKey(repository.value, each)),
      )
    ) {
      throw new InvalidMemoryError('bears only on paths its run changed');
    }

    return MemoryScope.of({
      teamId: this.site.teamId,
      lineId: reach === 'team' ? null : this.site.lineId,
      stationId: reach === 'station' ? this.site.stationId : null,
      repository,
      paths,
    });
  }

  private sourceOf(grounds: MemoryGrounds): MemorySource {
    const speakers = grounds.notes.map((each) => this.speakerOf(each));

    if (this.fromOutside || speakers.includes('world')) {
      return 'outside';
    }

    return grounds.onlyNotes ? 'person' : 'run';
  }
}
