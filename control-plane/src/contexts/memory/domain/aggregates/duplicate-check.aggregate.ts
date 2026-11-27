import type { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { DuplicateVerdict } from '@memory/domain/value-objects/duplicate-verdict.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const DUPLICATE_CHECK_STATES = [
  'pending',
  'compared',
  'failed',
] as const;

export type DuplicateCheckState = (typeof DUPLICATE_CHECK_STATES)[number];

/** A proposal of the run and the memories it is compared with: never empty. */
export interface DuplicateComparison {
  readonly proposal: MemoryProposal;
  readonly candidates: readonly Memory[];
}

/** What a model said about one proposal: the handle of the memory it repeats, or none, and why. */
export interface ReportedVerdict {
  readonly proposal: MemoryId;
  readonly sameAs: string | null;
  readonly reason: string;
}

/** The memory a proposal repeats, as the check found it and as it stands now. */
export interface Repeat {
  readonly memory: Memory;
  readonly reason: string;
}

interface CheckFields {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly taskId: TaskId;
  readonly setId: MemoryProposalSetId;
  readonly createdAt: Date;
  readonly state: DuplicateCheckState;
  readonly job: PendingJob;
  readonly verdicts: readonly DuplicateVerdict[];
  readonly version: number;
}

const handleOf = (raw: string): MemoryHandle | null => {
  try {
    return MemoryHandle.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Whether what a run proposed to remember repeats what the team already remembers. One per run that proposed a
 * memory; a model compares the proposals with their candidates once, and the verdicts it gives stay with the run.
 */
export class DuplicateCheck implements HasPendingJob<DuplicateCheck> {
  private constructor(private readonly c: CheckFields) {}

  /** The check of a run that proposed memories to compare, due now; none when the run proposed nothing to compare. */
  static of(input: {
    runId: RunId;
    set: MemoryProposalSet;
    now: Date;
  }): DuplicateCheck | null {
    const [first] = input.set.comparableIn(input.runId);

    if (!first) {
      return null;
    }

    return new DuplicateCheck({
      runId: input.runId,
      workspaceId: input.set.workspaceId,
      teamId: first.scope.teamId,
      taskId: input.set.taskId,
      setId: input.set.id,
      createdAt: input.now,
      state: 'pending',
      job: PendingJob.fresh(),
      verdicts: [],
      version: 0,
    });
  }

  static rehydrate(fields: CheckFields): DuplicateCheck {
    if (fields.version < 0) {
      throw new InconsistentStateError(
        'duplicate check',
        'has a negative version',
      );
    }

    if (fields.state !== 'compared' && fields.verdicts.length > 0) {
      throw new InconsistentStateError(
        'duplicate check',
        'has verdicts before it compared',
      );
    }

    return new DuplicateCheck(fields);
  }

  get runId(): RunId {
    return this.c.runId;
  }

  get workspaceId(): WorkspaceId {
    return this.c.workspaceId;
  }

  get teamId(): TeamId {
    return this.c.teamId;
  }

  get taskId(): TaskId {
    return this.c.taskId;
  }

  get setId(): MemoryProposalSetId {
    return this.c.setId;
  }

  get createdAt(): Date {
    return this.c.createdAt;
  }

  get state(): DuplicateCheckState {
    return this.c.state;
  }

  get job(): PendingJob {
    return this.c.job;
  }

  get verdicts(): readonly DuplicateVerdict[] {
    return this.c.verdicts;
  }

  get version(): number {
    return this.c.version;
  }

  get hasPendingJob(): boolean {
    return this.c.state === 'pending';
  }

  get jobExhausted(): boolean {
    return this.hasPendingJob && this.c.job.exhausted;
  }

  isDue(now: Date): boolean {
    return this.hasPendingJob && this.c.job.isDue(now);
  }

  /**
   * The proposals of its run that are still compared, each with its candidates, leaving out a proposal with none.
   * Nothing when the set is not the one the run proposed in, such as after the task was deleted.
   */
  comparing(
    set: MemoryProposalSet | null,
    memories: readonly Memory[],
  ): readonly DuplicateComparison[] {
    if (!set?.id.equals(this.c.setId)) {
      return [];
    }

    return set
      .comparableIn(this.c.runId)
      .map((proposal) => ({
        proposal,
        candidates: proposal.candidatesIn(memories),
      }))
      .filter((each) => each.candidates.length > 0);
  }

  leaseJob(now: Date): DuplicateCheck {
    if (!this.isDue(now) || this.c.job.exhausted) {
      throw new InvalidMemoryError('is not due yet', 'duplicate check');
    }

    return this.with({ job: this.c.job.lease(now) });
  }

  scheduleRetry(now: Date): DuplicateCheck {
    return this.hasPendingJob
      ? this.with({ job: this.c.job.scheduleRetry(now) })
      : this;
  }

  waitJob(now: Date): DuplicateCheck {
    return this.hasPendingJob ? this.with({ job: this.c.job.wait(now) }) : this;
  }

  /** Whether its job may wait once more, or would run out of time waiting and be dead-lettered. */
  mayWaitAgain(now: Date): boolean {
    return !this.c.job.wait(now).exhausted;
  }

  /** Makes its waiting job due now, once the session that compares its run settled. Any other check stays as it is. */
  wake(now: Date): DuplicateCheck {
    if (!this.hasPendingJob) {
      return this;
    }

    const job = this.c.job.wake(now);

    return job === this.c.job ? this : this.with({ job });
  }

  /**
   * Records what the model said about the proposals it compared. A verdict counts only for a proposal it was asked
   * about, and may name only a memory that was a candidate for that proposal: any other verdict, or a second one for
   * the same proposal, is dropped, never trusted.
   */
  compared(
    comparing: readonly DuplicateComparison[],
    reported: readonly ReportedVerdict[],
  ): DuplicateCheck {
    if (!this.hasPendingJob) {
      return this;
    }

    const verdicts: DuplicateVerdict[] = [];

    for (const each of reported) {
      const asked = comparing.find(({ proposal }) =>
        proposal.id.equals(each.proposal),
      );

      if (!asked || verdicts.some((one) => one.isAbout(each.proposal))) {
        continue;
      }

      const handle = each.sameAs === null ? null : handleOf(each.sameAs);
      const repeats = handle
        ? asked.candidates.find((memory) => memory.handle.equals(handle))
        : undefined;

      if (each.sameAs !== null && !repeats) {
        continue;
      }

      verdicts.push(
        DuplicateVerdict.of({
          proposal: asked.proposal.id,
          repeats: repeats?.id ?? null,
          reason: each.reason,
        }),
      );
    }

    return this.with({ state: 'compared', job: PendingJob.fresh(), verdicts });
  }

  failed(): DuplicateCheck {
    return this.hasPendingJob
      ? this.with({ state: 'failed', job: PendingJob.fresh(), verdicts: [] })
      : this;
  }

  deadLetter(): DuplicateCheck {
    return this.failed();
  }

  /** The memories its verdicts say a proposal repeats. */
  get repeatedMemories(): readonly MemoryId[] {
    return this.c.verdicts.flatMap((each) =>
      each.repeats ? [each.repeats] : [],
    );
  }

  /**
   * The memory the proposal repeats, among the team's current memories: only while the proposal is still proposed,
   * and that memory is still active and still one it is compared with.
   */
  repeatOf(
    proposal: MemoryProposal,
    memories: readonly Memory[],
  ): Repeat | null {
    const verdict = this.c.verdicts.find((each) => each.isAbout(proposal.id));
    const repeats = verdict?.repeats;

    if (!verdict || !repeats) {
      return null;
    }

    const memory = proposal
      .candidatesIn(memories)
      .find((each) => each.id.equals(repeats));

    return memory ? { memory, reason: verdict.reason } : null;
  }

  private with(change: Partial<CheckFields>): DuplicateCheck {
    return new DuplicateCheck({ ...this.c, ...change });
  }
}
