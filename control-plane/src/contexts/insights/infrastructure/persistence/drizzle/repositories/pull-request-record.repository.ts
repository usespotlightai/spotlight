import {
  PullRequestRecord,
  type ReviewTask,
} from '@insights/domain/aggregates/pull-request-record.aggregate';
import { PullRequestRecordVersionConflictError } from '@insights/domain/exceptions/pull-request-record-version-conflict.error';
import type { PullRequestRecordRepository } from '@insights/domain/repositories/pull-request-record.repository';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import {
  type PullRequestRow,
  seenOfRow,
} from '@insights/infrastructure/persistence/drizzle/mappers/pull-request-seen.mapper';
import { pullRequestRecord } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { inList } from '@platform/persistence/drizzle/in-list';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, arrayContains, eq, isNull, lt, or, sql } from 'drizzle-orm';

const reviewTasksOf = (row: PullRequestRow): readonly ReviewTask[] => {
  if (row.reviewTaskIds.length !== row.reviewTeamIds.length) {
    throw new InconsistentStateError(
      'pull request record',
      'holds review tasks without their teams',
    );
  }

  return row.reviewTaskIds.map((taskId, at) => ({
    taskId: TaskId.of(taskId),
    teamId: TeamId.of(row.reviewTeamIds[at] as string),
  }));
};

const toRecord = (row: PullRequestRow): PullRequestRecord =>
  PullRequestRecord.rehydrate({
    workspaceId: WorkspaceId.of(row.workspaceId),
    pullRequest: PullRequestUrl.of(row.pullRequest),
    seen: seenOfRow(row),
    owner:
      row.ownerTaskId && row.ownerTeamId && row.ownerOpenedAt
        ? {
            taskId: TaskId.of(row.ownerTaskId),
            teamId: TeamId.of(row.ownerTeamId),
            openedAt: row.ownerOpenedAt,
          }
        : null,
    reviewTasks: reviewTasksOf(row),
    githubPurgedAt: row.githubPurgedAt,
    version: row.version,
  });

const columnsOf = (record: PullRequestRecord) => {
  const seen = record.seen;

  return {
    repository: seen?.repository ?? null,
    number: seen?.number ?? null,
    title: seen?.title ?? null,
    author: seen?.author ?? null,
    authorIsBot: seen?.authorIsBot ?? false,
    branch: seen?.branch ?? null,
    additions: seen?.additions ?? null,
    deletions: seen?.deletions ?? null,
    changedFiles: seen?.changedFiles ?? null,
    openedAt: seen?.openedAt ?? null,
    state: seen?.state ?? null,
    closedAt: seen?.closedAt ?? null,
    updatedAt: seen?.updatedAt ?? null,
    readyForReviewAt: seen?.readyForReviewAt ?? null,
    draftPeriods: (seen?.draftPeriods ?? []).map((each) => ({
      from: each.from.toISOString(),
      to: each.to?.toISOString() ?? null,
    })),
    firstReviewAt: seen?.firstReviewAt ?? null,
    firstUnblockingReviewAt: seen?.firstUnblockingReviewAt ?? null,
    firstApprovedAt: seen?.firstApprovedAt ?? null,
    humanReviewedAt: [...(seen?.humanReviewedAt ?? [])],
    reviews: seen?.reviews ?? 0,
    reviewRounds: seen?.reviewRounds ?? 0,
    reviewComments: seen?.reviewComments ?? 0,
    botActivity: [...(seen?.botActivity ?? [])],
    isRevert: seen?.isRevert ?? false,
    revertedBy: seen?.revertedBy ?? null,
    seenVersion: seen?.version ?? null,
    ownerTaskId: record.owner?.taskId.value ?? null,
    ownerTeamId: record.owner?.teamId.value ?? null,
    ownerOpenedAt: record.owner?.openedAt ?? null,
    reviewTaskIds: record.reviewTasks.map((each) => each.taskId.value),
    reviewTeamIds: record.reviewTasks.map((each) => each.teamId.value),
    githubPurgedAt: record.githubPurgedAt,
  };
};

const at = (workspaceId: WorkspaceId, pullRequest: PullRequestUrl) =>
  and(
    eq(pullRequestRecord.workspaceId, workspaceId.value),
    eq(pullRequestRecord.pullRequest, pullRequest.value),
  );

@Injectable()
export class DrizzlePullRequestRecordRepository
  implements PullRequestRecordRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async at(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<PullRequestRecord | null> {
    const [row] = await this.context.db
      .select()
      .from(pullRequestRecord)
      .where(at(workspaceId, pullRequest))
      .limit(1);

    return row ? toRecord(row) : null;
  }

  async ownedBy(
    taskIds: readonly TaskId[],
  ): Promise<readonly PullRequestRecord[]> {
    if (taskIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(pullRequestRecord)
      .where(
        inList(
          pullRequestRecord.ownerTaskId,
          taskIds.map((each) => each.value),
        ),
      );

    return rows.map(toRecord);
  }

  add(added: PullRequestRecord): Promise<void> {
    return this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(pullRequestRecord)
        .values({
          workspaceId: added.workspaceId.value,
          pullRequest: added.pullRequest.value,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing()
        .returning({ pullRequest: pullRequestRecord.pullRequest });

      if (written.length === 0) {
        throw new PullRequestRecordVersionConflictError(
          added.pullRequest.value,
        );
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  save(saved: PullRequestRecord): Promise<void> {
    return this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(pullRequestRecord)
        .set({ version: saved.version + 1, ...columnsOf(saved) })
        .where(
          and(
            at(saved.workspaceId, saved.pullRequest),
            eq(pullRequestRecord.version, saved.version),
          ),
        )
        .returning({ pullRequest: pullRequestRecord.pullRequest });

      if (written.length === 0) {
        throw new PullRequestRecordVersionConflictError(
          saved.pullRequest.value,
        );
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  remove(removed: PullRequestRecord): Promise<void> {
    return this.context.inTransaction(async () => {
      const gone = await this.context.db
        .delete(pullRequestRecord)
        .where(
          and(
            at(removed.workspaceId, removed.pullRequest),
            eq(pullRequestRecord.version, removed.version),
          ),
        )
        .returning({ pullRequest: pullRequestRecord.pullRequest });

      if (gone.length === 0) {
        throw new PullRequestRecordVersionConflictError(
          removed.pullRequest.value,
        );
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly PullRequestRecord[]> {
    const rows = await this.context.db
      .select()
      .from(pullRequestRecord)
      .where(
        and(
          eq(pullRequestRecord.workspaceId, scope.workspaceId.value),
          scope.kind === 'task'
            ? or(
                eq(pullRequestRecord.ownerTaskId, scope.taskId.value),
                arrayContains(pullRequestRecord.reviewTaskIds, [
                  scope.taskId.value,
                ]),
              )
            : scope.kind === 'team'
              ? or(
                  eq(pullRequestRecord.ownerTeamId, scope.teamId.value),
                  arrayContains(pullRequestRecord.reviewTeamIds, [
                    scope.teamId.value,
                  ]),
                )
              : undefined,
        ),
      )
      .limit(max);

    return rows.map(toRecord);
  }

  async tombstonesBefore(
    before: Date,
    max: number,
  ): Promise<readonly PullRequestRecord[]> {
    const rows = await this.context.db
      .select()
      .from(pullRequestRecord)
      .where(
        and(
          lt(pullRequestRecord.githubPurgedAt, before),
          isNull(pullRequestRecord.ownerTaskId),
          sql`cardinality(${pullRequestRecord.reviewTaskIds}) = 0`,
        ),
      )
      .limit(max);

    return rows.map(toRecord);
  }
}
