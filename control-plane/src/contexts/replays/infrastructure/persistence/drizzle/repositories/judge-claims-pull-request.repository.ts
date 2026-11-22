import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { JudgeClaimsPullRequest } from '@replays/domain/aggregates/judge-claims-pull-request.aggregate';
import { JudgeClaimsPullRequestVersionConflictError } from '@replays/domain/exceptions/judge-claims-pull-request-version-conflict.error';
import type { JudgeClaimsPullRequestRepository } from '@replays/domain/repositories/judge-claims-pull-request.repository';
import { CommitSha } from '@replays/domain/value-objects/commit-sha.vo';
import { judgeClaimsPullRequest } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';

type Row = typeof judgeClaimsPullRequest.$inferSelect;

const toPullRequest = (row: Row): JudgeClaimsPullRequest =>
  JudgeClaimsPullRequest.rehydrate({
    revisionId: row.revisionId,
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: LineId.of(row.lineId),
      stationId: StationId.of(row.stationId),
    },
    proposal: {
      trigger: row.trigger,
      claimsBefore: row.claimsBefore,
      claimsAfter: row.claimsAfter,
      searched: row.searched,
      heldOut: row.heldOut,
      disagreementRuns: row.disagreementRuns,
    },
    state: row.state,
    job: row.pending
      ? PendingJob.rehydrate({
          attempts: row.jobAttempts,
          nextAttemptAt: row.jobDueAt,
          waitingSince: row.waitingSince,
        })
      : null,
    lastCommit: row.lastCommit ? CommitSha.of(row.lastCommit) : null,
    url: row.url,
    reason: row.reason,
    requestedAt: row.requestedAt,
    updatedAt: row.updatedAt,
    version: row.version,
  });

const columnsOf = (stored: JudgeClaimsPullRequest) => ({
  state: stored.state,
  pending: stored.job !== null,
  jobAttempts: stored.job?.attempts ?? 0,
  jobDueAt: stored.job?.nextAttemptAt ?? null,
  waitingSince: stored.job?.waitingSince ?? null,
  lastCommit: stored.lastCommit,
  url: stored.url,
  reason: stored.reason,
  updatedAt: stored.updatedAt,
});

@Injectable()
export class DrizzleJudgeClaimsPullRequestRepository
  implements JudgeClaimsPullRequestRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: JudgeClaimsPullRequest): Promise<void> {
    await this.context.inTransaction(async () => {
      const { station, proposal } = added;
      const written = await this.context.db
        .insert(judgeClaimsPullRequest)
        .values({
          revisionId: added.revisionId,
          workspaceId: station.workspaceId.value,
          teamId: station.teamId.value,
          lineId: station.lineId.value,
          stationId: station.stationId.value,
          trigger: proposal.trigger,
          claimsBefore: [...proposal.claimsBefore],
          claimsAfter: [...proposal.claimsAfter],
          searched: proposal.searched,
          heldOut: proposal.heldOut,
          disagreementRuns: proposal.disagreementRuns.map((each) => ({
            ...each,
            claimsWrong: [...each.claimsWrong],
          })),
          requestedAt: added.requestedAt,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing()
        .returning({ revisionId: judgeClaimsPullRequest.revisionId });

      if (written.length === 0) {
        throw new JudgeClaimsPullRequestVersionConflictError(added.revisionId);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: JudgeClaimsPullRequest): Promise<void> {
    await this.context.inTransaction(async () => {
      const matches = and(
        eq(judgeClaimsPullRequest.revisionId, saved.revisionId),
        eq(judgeClaimsPullRequest.version, saved.version),
      );
      const written = saved.isDeleted
        ? await this.context.db
            .delete(judgeClaimsPullRequest)
            .where(matches)
            .returning({ revisionId: judgeClaimsPullRequest.revisionId })
        : await this.context.db
            .update(judgeClaimsPullRequest)
            .set({ version: saved.version + 1, ...columnsOf(saved) })
            .where(matches)
            .returning({ revisionId: judgeClaimsPullRequest.revisionId });

      if (written.length === 0) {
        throw new JudgeClaimsPullRequestVersionConflictError(saved.revisionId);
      }

      if (!saved.isDeleted) {
        await this.events.dispatch(saved.pullEvents());
      }
    });
  }

  async find(revisionId: string): Promise<JudgeClaimsPullRequest | null> {
    const [row] = await this.context.db
      .select()
      .from(judgeClaimsPullRequest)
      .where(eq(judgeClaimsPullRequest.revisionId, revisionId))
      .limit(1);

    return row ? toPullRequest(row) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly JudgeClaimsPullRequest[]> {
    const rows = await this.context.db
      .select()
      .from(judgeClaimsPullRequest)
      .where(eq(judgeClaimsPullRequest.teamId, teamId.value));

    return rows.map(toPullRequest);
  }

  async nextDueJob(now: Date): Promise<JudgeClaimsPullRequest | null> {
    const [row] = await this.context.db
      .select()
      .from(judgeClaimsPullRequest)
      .where(
        and(
          eq(judgeClaimsPullRequest.pending, true),
          or(
            isNull(judgeClaimsPullRequest.jobDueAt),
            lte(judgeClaimsPullRequest.jobDueAt, now),
          ),
        ),
      )
      .orderBy(asc(judgeClaimsPullRequest.requestedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toPullRequest(row) : null;
  }
}
