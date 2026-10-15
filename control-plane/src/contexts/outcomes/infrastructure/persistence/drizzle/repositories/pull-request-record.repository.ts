import { Injectable } from '@nestjs/common';
import { PullRequestRecord } from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import { PullRequestRecordMovedOnError } from '@outcomes/domain/exceptions/pull-request-record-moved-on.error';
import type {
  PullRequestRecordRepository,
  TeamPullRequestWindow,
} from '@outcomes/domain/repositories/pull-request-record.repository';
import {
  type PullRequestRow,
  seenOfRow,
} from '@outcomes/infrastructure/persistence/drizzle/mappers/pull-request-seen.mapper';
import { pullRequestRecord } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  and,
  arrayContains,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';

const toRecord = (row: PullRequestRow): PullRequestRecord =>
  PullRequestRecord.rehydrate({
    workspaceId: WorkspaceId.of(row.workspaceId),
    pullRequest: PullRequestUrl.of(row.pullRequest),
    seen: seenOfRow(row),
    owner:
      row.ownerTaskId && row.ownerTeamId
        ? {
            taskId: TaskId.of(row.ownerTaskId),
            teamId: TeamId.of(row.ownerTeamId),
          }
        : null,
    reviewTasks: row.reviewTaskIds.map((each) => TaskId.of(each)),
    githubForgotAt: row.githubForgotAt,
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
    draftSpells: (seen?.draftSpells ?? []).map((each) => ({
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
    reviewTaskIds: record.reviewTasks.map((each) => each.value),
    githubForgotAt: record.githubForgotAt,
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
  constructor(private readonly context: DrizzleContext) {}

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

  async add(added: PullRequestRecord): Promise<void> {
    const written = await this.context.db
      .insert(pullRequestRecord)
      .values({
        workspaceId: added.workspaceId.value,
        pullRequest: added.pullRequest.value,
        version: added.version + 1,
        ...columnsOf(added),
      })
      .onConflictDoNothing()
      .returning({ pullRequest: pullRequestRecord.pullRequest });

    if (written.length === 0) {
      throw new PullRequestRecordMovedOnError(added.pullRequest.value);
    }
  }

  async save(saved: PullRequestRecord): Promise<void> {
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
      throw new PullRequestRecordMovedOnError(saved.pullRequest.value);
    }
  }

  async remove(removed: PullRequestRecord): Promise<void> {
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
      throw new PullRequestRecordMovedOnError(removed.pullRequest.value);
    }
  }

  async seenForTeamBetween(
    window: TeamPullRequestWindow,
    most: number,
  ): Promise<readonly PullRequestRecord[]> {
    const repositories = window.repositories.map((each) => each.toLowerCase());
    const rows = await this.context.db
      .select()
      .from(pullRequestRecord)
      .where(
        and(
          eq(pullRequestRecord.workspaceId, window.workspaceId.value),
          isNotNull(pullRequestRecord.seenVersion),
          or(
            eq(pullRequestRecord.ownerTeamId, window.teamId.value),
            repositories.length > 0
              ? inArray(pullRequestRecord.repository, repositories)
              : sql`false`,
          ),
          lt(pullRequestRecord.openedAt, window.to),
          or(
            isNull(pullRequestRecord.closedAt),
            gte(pullRequestRecord.closedAt, window.from),
          ),
        ),
      )
      .orderBy(
        desc(pullRequestRecord.openedAt),
        desc(pullRequestRecord.pullRequest),
      )
      .limit(most);

    return rows.map(toRecord);
  }

  async heldByTask(
    workspaceId: WorkspaceId,
    taskId: TaskId,
  ): Promise<readonly PullRequestRecord[]> {
    const rows = await this.context.db
      .select()
      .from(pullRequestRecord)
      .where(
        and(
          eq(pullRequestRecord.workspaceId, workspaceId.value),
          or(
            eq(pullRequestRecord.ownerTaskId, taskId.value),
            arrayContains(pullRequestRecord.reviewTaskIds, [taskId.value]),
          ),
        ),
      );

    return rows.map(toRecord);
  }

  async ownedByTeam(
    workspaceId: WorkspaceId,
    teamId: TeamId,
  ): Promise<readonly PullRequestRecord[]> {
    const rows = await this.context.db
      .select()
      .from(pullRequestRecord)
      .where(
        and(
          eq(pullRequestRecord.workspaceId, workspaceId.value),
          eq(pullRequestRecord.ownerTeamId, teamId.value),
        ),
      );

    return rows.map(toRecord);
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(pullRequestRecord)
      .where(eq(pullRequestRecord.workspaceId, workspaceId.value));
  }
}
