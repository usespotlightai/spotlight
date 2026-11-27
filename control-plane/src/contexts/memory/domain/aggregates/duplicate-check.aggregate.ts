import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { DuplicateQuestion } from '@memory/domain/value-objects/duplicate-question.vo';
import type { DuplicateVerdict } from '@memory/domain/value-objects/duplicate-verdict.vo';
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

interface CheckFields {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly taskId: TaskId;
  readonly setId: MemoryProposalSetId;
  readonly createdAt: Date;
  readonly state: DuplicateCheckState;
  readonly job: PendingJob;
  readonly question: DuplicateQuestion | null;
  readonly verdicts: readonly DuplicateVerdict[];
  readonly version: number;
}

const verdictsFit = (
  question: DuplicateQuestion | null,
  verdicts: readonly DuplicateVerdict[],
): boolean =>
  verdicts.every(
    (each, at) =>
      question !== null &&
      question.asked(each.proposal) &&
      (each.repeats === null ||
        question.compared(each.proposal, each.repeats)) &&
      verdicts.findIndex((one) => one.isAbout(each.proposal)) === at,
  );

/**
 * Whether what a run proposed to remember repeats what the team already remembers. One per run that proposed a
 * memory to compare. It records the question its session was ordered with, once, and keeps the verdicts the model
 * gave about that question.
 */
export class DuplicateCheck implements HasPendingJob<DuplicateCheck> {
  private deleted = false;

  private constructor(private readonly c: CheckFields) {}

  static due(input: {
    runId: RunId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    taskId: TaskId;
    setId: MemoryProposalSetId;
    now: Date;
  }): DuplicateCheck {
    return new DuplicateCheck({
      runId: input.runId,
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      taskId: input.taskId,
      setId: input.setId,
      createdAt: input.now,
      state: 'pending',
      job: PendingJob.fresh(),
      question: null,
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

    if (
      (fields.state !== 'compared' && fields.verdicts.length > 0) ||
      !verdictsFit(fields.question, fields.verdicts)
    ) {
      throw new InconsistentStateError(
        'duplicate check',
        'has verdicts it did not ask for',
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

  /** What its session was asked, once it was ordered; null before. */
  get question(): DuplicateQuestion | null {
    return this.c.question;
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

  /** Whether it checks the proposals of this set: a set made anew for the task after its own was deleted is not. */
  isFor(setId: MemoryProposalSetId): boolean {
    return this.c.setId.equals(setId);
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

  /** Records the question its session is ordered with. It asks once: a check that asked already keeps its question. */
  asking(question: DuplicateQuestion): DuplicateCheck {
    if (!this.hasPendingJob) {
      throw new InvalidMemoryError('asks only while due', 'duplicate check');
    }

    return this.c.question ? this : this.with({ question });
  }

  /**
   * Records what the model said, and is done. Each verdict is about a proposal it asked about, at most one per
   * proposal, and names only a memory it compared that proposal with. With no question, it compared nothing.
   */
  compared(verdicts: readonly DuplicateVerdict[]): DuplicateCheck {
    if (!this.hasPendingJob) {
      return this;
    }

    if (!verdictsFit(this.c.question, verdicts)) {
      throw new InvalidMemoryError(
        'records only verdicts about what it asked',
        'duplicate check',
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

  /** What the model said about the proposal, or null when the check holds no verdict on it. */
  verdictFor(proposal: MemoryId): DuplicateVerdict | null {
    return this.c.verdicts.find((each) => each.isAbout(proposal)) ?? null;
  }

  /** The memories its verdicts say a proposal repeats. */
  get repeatedMemories(): readonly MemoryId[] {
    return this.c.verdicts.flatMap((each) =>
      each.repeats ? [each.repeats] : [],
    );
  }

  get isDeleted(): boolean {
    return this.deleted;
  }

  delete(): DuplicateCheck {
    const deleted = this.with({});
    deleted.deleted = true;
    return deleted;
  }

  private with(change: Partial<CheckFields>): DuplicateCheck {
    return new DuplicateCheck({ ...this.c, ...change });
  }
}
