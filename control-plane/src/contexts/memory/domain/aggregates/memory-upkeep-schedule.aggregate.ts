import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const UPKEEP_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

export const UPKEEP_AFTER_NEW_MEMORIES = 20;

interface ScheduleFields {
  readonly teamId: TeamId;
  readonly workspaceId: WorkspaceId;
  readonly dueAt: Date;
  readonly addedSince: number;
  readonly job: PendingJob;
  readonly version: number;
}

export class MemoryUpkeepSchedule implements HasPendingJob<MemoryUpkeepSchedule> {
  private constructor(private readonly s: ScheduleFields) {}

  static first(input: {
    teamId: TeamId;
    workspaceId: WorkspaceId;
    now: Date;
  }): MemoryUpkeepSchedule {
    return new MemoryUpkeepSchedule({
      teamId: input.teamId,
      workspaceId: input.workspaceId,
      dueAt: new Date(input.now.getTime() + UPKEEP_EVERY_MS),
      addedSince: 0,
      job: PendingJob.fresh(),
      version: 0,
    });
  }

  static rehydrate(fields: ScheduleFields): MemoryUpkeepSchedule {
    if (fields.version < 0 || fields.addedSince < 0) {
      throw new InconsistentStateError(
        'memory upkeep schedule',
        'has a negative version or count',
      );
    }

    return new MemoryUpkeepSchedule(fields);
  }

  get teamId(): TeamId {
    return this.s.teamId;
  }

  get workspaceId(): WorkspaceId {
    return this.s.workspaceId;
  }

  get dueAt(): Date {
    return this.s.dueAt;
  }

  get addedSince(): number {
    return this.s.addedSince;
  }

  get job(): PendingJob {
    return this.s.job;
  }

  get version(): number {
    return this.s.version;
  }

  get hasPendingJob(): boolean {
    return this.s.job.attempts > 0;
  }

  get jobExhausted(): boolean {
    return this.s.job.exhausted;
  }

  isDue(now: Date): boolean {
    return this.s.dueAt.getTime() <= now.getTime() && this.s.job.isDue(now);
  }

  memoryAdded(now: Date): MemoryUpkeepSchedule {
    if (this.s.dueAt <= now) {
      return this;
    }

    const addedSince = this.s.addedSince + 1;

    return this.with({
      addedSince,
      dueAt: addedSince >= UPKEEP_AFTER_NEW_MEMORIES ? now : this.s.dueAt,
    });
  }

  leaseJob(now: Date): MemoryUpkeepSchedule {
    if (!this.isDue(now) || this.s.job.exhausted) {
      throw new InvalidMemoryError('is not due yet', 'memory upkeep schedule');
    }

    return this.with({ job: this.s.job.lease(now) });
  }

  swept(now: Date): MemoryUpkeepSchedule {
    return this.with({
      dueAt: new Date(now.getTime() + UPKEEP_EVERY_MS),
      addedSince: 0,
      job: PendingJob.fresh(),
    });
  }

  scheduleRetry(now: Date): MemoryUpkeepSchedule {
    return this.with({ job: this.s.job.scheduleRetry(now) });
  }

  deadLetter(now: Date): MemoryUpkeepSchedule {
    return this.swept(now);
  }

  private with(change: Partial<ScheduleFields>): MemoryUpkeepSchedule {
    return new MemoryUpkeepSchedule({ ...this.s, ...change });
  }
}
