import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackVersionConflictError } from '@change-review/domain/exceptions/change-stack-version-conflict.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { CommitSha } from '@change-review/domain/value-objects/commit-sha.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import {
  cohortRows,
  cohortsOf,
  diffOf,
  factRows,
  factsOf,
  fileRows,
  progressOf,
} from '@change-review/infrastructure/persistence/drizzle/repositories/change-stack.mapping';
import { changeStack } from '@change-review/infrastructure/persistence/drizzle/schemas/change-stack.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';

type Row = typeof changeStack.$inferSelect;

const usageRow = (usage: ModelUsage) => ({
  calls: usage.calls,
  inputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  costs: usage.costs.map((each) => ({ ...each })),
  unpriced: usage.unpriced,
});

const baseOf = (raw: string): CommitSha => {
  const sha = CommitSha.parsed(raw);

  if (!sha) {
    throw new InconsistentStateError(
      'change stack',
      'has a base that is not a commit hash',
    );
  }

  return sha;
};

const toChangeStack = (row: Row): ChangeStack =>
  ChangeStack.rehydrate({
    id: ChangeStackId.of(row.id),
    runId: RunId.of(row.runId),
    taskId: row.taskId ? TaskId.of(row.taskId) : null,
    teamId: row.teamId ? TeamId.of(row.teamId) : null,
    trial: row.trial,
    workspaceId: WorkspaceId.of(row.workspaceId),
    repository: row.repository ? RepositoryName.of(row.repository) : null,
    base: row.baseCommit ? baseOf(row.baseCommit) : null,
    diff: diffOf(row.files),
    facts: factsOf(row.facts),
    cohorts: cohortsOf(row.cohorts),
    progress: progressOf(row),
    job: PendingJob.rehydrate({
      attempts: row.jobAttempts,
      nextAttemptAt: row.jobDueAt,
    }),
    request: row.checkCommand
      ? CheckRequest.of(
          row.checkCommand,
          row.checkSetup,
          RunnerPlacement.ofLabelGroups(
            row.checkPlacement,
            row.checkPlacementImage
              ? RunnerImage.of(row.checkPlacementImage)
              : null,
          ),
        )
      : null,
    redrafting: row.redrafting,
    usage: ModelUsage.rehydrate(row.usage),
    version: row.version,
  });

@Injectable()
export class DrizzleChangeStackRepository implements ChangeStackRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: ChangeStack): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: ChangeStack): Promise<void> {
    await this.context.db.insert(changeStack).values({
      id: added.id.value,
      runId: added.runId.value,
      taskId: added.taskId?.value ?? null,
      teamId: added.teamId?.value ?? null,
      trial: added.trial,
      workspaceId: added.workspaceId.value,
      repository: added.repository?.value ?? null,
      baseCommit: added.base?.value ?? null,
      state: added.state,
      files: fileRows(added.diff.files),
      cohorts: cohortRows(added.cohorts),
      failure: added.failure,
      startedAt: added.startedAt,
      completedAt: added.completedAt,
      facts: factRows(added.facts),
      jobAttempts: added.job.attempts,
      jobDueAt: added.job.nextAttemptAt,
      checkCommand: added.request?.command ?? null,
      checkSetup: added.request?.setup ?? null,
      checkPlacement: added.request?.placement.labelGroups ?? [],
      checkPlacementImage: added.request?.placement.image?.value ?? null,
      redrafting: added.redrafting,
      pendingJob: added.hasPendingJob,
      usage: usageRow(added.usage),
      version: added.version,
    });
  }

  async save(saved: ChangeStack): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async stored(saved: ChangeStack): Promise<void> {
    const written = await this.context.db
      .update(changeStack)
      .set({
        version: saved.version + 1,
        state: saved.state,
        cohorts: cohortRows(saved.cohorts),
        failure: saved.failure,
        completedAt: saved.completedAt,
        jobAttempts: saved.job.attempts,
        jobDueAt: saved.job.nextAttemptAt,
        redrafting: saved.redrafting,
        pendingJob: saved.hasPendingJob,
        usage: usageRow(saved.usage),
      })
      .where(
        and(
          eq(changeStack.id, saved.id.value),
          eq(changeStack.version, saved.version),
        ),
      )
      .returning({ id: changeStack.id });

    if (written.length === 0) {
      throw new ChangeStackVersionConflictError(saved.id.value);
    }
  }

  async find(id: ChangeStackId): Promise<ChangeStack | null> {
    const [row] = await this.context.db
      .select()
      .from(changeStack)
      .where(eq(changeStack.id, id.value))
      .limit(1);

    return row ? toChangeStack(row) : null;
  }

  async ofRun(runId: RunId): Promise<readonly ChangeStack[]> {
    const rows = await this.context.db
      .select()
      .from(changeStack)
      .where(eq(changeStack.runId, runId.value))
      .orderBy(asc(changeStack.startedAt), asc(changeStack.id));

    return rows.map(toChangeStack);
  }

  async nextDueJob(now: Date): Promise<ChangeStack | null> {
    const [row] = await this.context.db
      .select()
      .from(changeStack)
      .where(
        and(
          eq(changeStack.pendingJob, true),
          or(isNull(changeStack.jobDueAt), lte(changeStack.jobDueAt, now)),
        ),
      )
      .orderBy(asc(changeStack.startedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toChangeStack(row) : null;
  }

  async ofTask(taskId: TaskId): Promise<readonly ChangeStack[]> {
    const rows = await this.context.db
      .select()
      .from(changeStack)
      .where(eq(changeStack.taskId, taskId.value));

    return rows.map(toChangeStack);
  }

  async ofTeam(teamId: TeamId): Promise<readonly ChangeStack[]> {
    const rows = await this.context.db
      .select()
      .from(changeStack)
      .where(eq(changeStack.teamId, teamId.value));

    return rows.map(toChangeStack);
  }

  async remove(removed: ChangeStack): Promise<void> {
    await this.context.inTransaction(async () => {
      const deleted = await this.context.db
        .delete(changeStack)
        .where(
          and(
            eq(changeStack.id, removed.id.value),
            eq(changeStack.version, removed.version),
          ),
        )
        .returning({ id: changeStack.id });

      if (deleted.length === 0) {
        throw new ChangeStackVersionConflictError(removed.id.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }
}
