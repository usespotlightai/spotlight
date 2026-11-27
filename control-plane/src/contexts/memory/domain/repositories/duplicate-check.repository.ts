import type { DuplicateCheck } from '@memory/domain/aggregates/duplicate-check.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const DUPLICATE_CHECKS = Symbol('MEMORY_DUPLICATE_CHECKS');

export interface DuplicateCheckRepository {
  of(runId: RunId): Promise<DuplicateCheck | null>;

  ofTask(taskId: TaskId): Promise<readonly DuplicateCheck[]>;

  ofTeam(teamId: TeamId): Promise<readonly DuplicateCheck[]>;

  /** Adds a new check; a version conflict when the run has one already. */
  add(check: DuplicateCheck): Promise<void>;

  save(check: DuplicateCheck): Promise<void>;

  remove(check: DuplicateCheck): Promise<void>;

  /** The next due check, locked for the caller's transaction and skipped by others. */
  nextDue(now: Date): Promise<DuplicateCheck | null>;
}
