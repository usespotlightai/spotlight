import { DuplicateCheck } from '@memory/domain/aggregates/duplicate-check.aggregate';
import { DuplicateCheckVersionConflictError } from '@memory/domain/exceptions/duplicate-check-version-conflict.error';
import type { DuplicateCheckRepository } from '@memory/domain/repositories/duplicate-check.repository';
import { DuplicateVerdict } from '@memory/domain/value-objects/duplicate-verdict.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { duplicateCheck } from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';

type CheckRow = typeof duplicateCheck.$inferSelect;

const checkOf = (row: CheckRow): DuplicateCheck =>
  DuplicateCheck.rehydrate({
    runId: RunId.of(row.runId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    taskId: TaskId.of(row.taskId),
    setId: MemoryProposalSetId.of(row.setId),
    createdAt: row.createdAt,
    state: row.state,
    job: PendingJob.rehydrate({
      attempts: row.jobAttempts,
      nextAttemptAt: row.jobDueAt,
      waitingSince: row.waitingSince,
    }),
    verdicts: row.verdicts.map((each) =>
      DuplicateVerdict.of({
        proposal: MemoryId.of(each.proposal),
        repeats: each.repeats === null ? null : MemoryId.of(each.repeats),
        reason: each.reason,
      }),
    ),
    version: row.version,
  });

const checkColumns = (check: DuplicateCheck) => ({
  state: check.state,
  jobAttempts: check.job.attempts,
  jobDueAt: check.job.nextAttemptAt,
  waitingSince: check.job.waitingSince,
  verdicts: check.verdicts.map((each) => ({
    proposal: each.proposal.value,
    repeats: each.repeats?.value ?? null,
    reason: each.reason,
  })),
});

@Injectable()
export class DrizzleDuplicateCheckRepository implements DuplicateCheckRepository {
  constructor(private readonly context: DrizzleContext) {}

  async of(runId: RunId): Promise<DuplicateCheck | null> {
    const [row] = await this.context.db
      .select()
      .from(duplicateCheck)
      .where(eq(duplicateCheck.runId, runId.value));

    return row ? checkOf(row) : null;
  }

  async ofTask(taskId: TaskId): Promise<readonly DuplicateCheck[]> {
    const rows = await this.context.db
      .select()
      .from(duplicateCheck)
      .where(eq(duplicateCheck.taskId, taskId.value));

    return rows.map(checkOf);
  }

  async ofTeam(teamId: TeamId): Promise<readonly DuplicateCheck[]> {
    const rows = await this.context.db
      .select()
      .from(duplicateCheck)
      .where(eq(duplicateCheck.teamId, teamId.value));

    return rows.map(checkOf);
  }

  async add(added: DuplicateCheck): Promise<void> {
    const [inserted] = await this.context.db
      .insert(duplicateCheck)
      .values({
        runId: added.runId.value,
        workspaceId: added.workspaceId.value,
        teamId: added.teamId.value,
        taskId: added.taskId.value,
        setId: added.setId.value,
        createdAt: added.createdAt,
        version: added.version,
        ...checkColumns(added),
      })
      .onConflictDoNothing({ target: duplicateCheck.runId })
      .returning({ runId: duplicateCheck.runId });

    if (!inserted) {
      throw new DuplicateCheckVersionConflictError(added.runId.value);
    }
  }

  async save(saved: DuplicateCheck): Promise<void> {
    const written = await this.context.db
      .update(duplicateCheck)
      .set({ version: saved.version + 1, ...checkColumns(saved) })
      .where(
        and(
          eq(duplicateCheck.runId, saved.runId.value),
          eq(duplicateCheck.version, saved.version),
        ),
      )
      .returning({ runId: duplicateCheck.runId });

    if (written.length === 0) {
      throw new DuplicateCheckVersionConflictError(saved.runId.value);
    }
  }

  async remove(removed: DuplicateCheck): Promise<void> {
    const deleted = await this.context.db
      .delete(duplicateCheck)
      .where(
        and(
          eq(duplicateCheck.runId, removed.runId.value),
          eq(duplicateCheck.version, removed.version),
        ),
      )
      .returning({ runId: duplicateCheck.runId });

    if (deleted.length === 0) {
      throw new DuplicateCheckVersionConflictError(removed.runId.value);
    }
  }

  async nextDue(now: Date): Promise<DuplicateCheck | null> {
    const [row] = await this.context.db
      .select()
      .from(duplicateCheck)
      .where(
        and(
          eq(duplicateCheck.state, 'pending'),
          or(
            isNull(duplicateCheck.jobDueAt),
            lte(duplicateCheck.jobDueAt, now),
          ),
        ),
      )
      .orderBy(asc(duplicateCheck.createdAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? checkOf(row) : null;
  }
}
