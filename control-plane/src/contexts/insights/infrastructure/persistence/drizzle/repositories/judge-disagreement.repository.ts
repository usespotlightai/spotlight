import { JudgeDisagreement } from '@insights/domain/aggregates/judge-disagreement.aggregate';
import { JudgeDisagreementVersionConflictError } from '@insights/domain/exceptions/judge-disagreement-version-conflict.error';
import type {
  AnsweredDisagreements,
  JudgeDisagreementRepository,
} from '@insights/domain/repositories/judge-disagreement.repository';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { ClaimAnswer } from '@insights/domain/value-objects/claim-answer.vo';
import { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import { NotMetAnswer } from '@insights/domain/value-objects/not-met-answer.vo';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import { inScope } from '@insights/infrastructure/persistence/drizzle/deletion-scope.sql';
import {
  judgeReasonOf,
  storedReasonOf,
} from '@insights/infrastructure/persistence/drizzle/mappers/score.mapper';
import { judgeDisagreement } from '@insights/infrastructure/persistence/drizzle/schemas/judge-repair.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, desc, eq, gt, isNotNull, isNull, ne } from 'drizzle-orm';

type JudgeDisagreementRow = typeof judgeDisagreement.$inferSelect;

const MAX_ANSWERED = 200;

const versionOf = (raw: string): RubricVersion => {
  const version = RubricVersion.readable(raw);

  if (!version) {
    throw new InconsistentStateError(
      'judge disagreement',
      'names a rubric version that is not 64 hex characters',
    );
  }

  return version;
};

const toDisagreement = (row: JudgeDisagreementRow): JudgeDisagreement =>
  JudgeDisagreement.rehydrate({
    id: JudgeDisagreementId.of(row.id),
    runId: RunId.of(row.runId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    location: RunLocation.of({
      teamId: TeamId.of(row.teamId),
      lineId: LineId.of(row.lineId),
      stationId: StationId.of(row.stationId),
      taskId: TaskId.of(row.taskId),
    }),
    verdict: {
      scoreId: ScoreId.of(row.scoreId),
      rubricVersion: versionOf(row.rubricVersion),
      claims: row.claims,
      claimResults: row.claimResults,
      reasons: row.reasons.map(judgeReasonOf),
    },
    labelFrom: row.labelFrom,
    askedOf: row.askedOfId ? UserId.of(row.askedOfId) : null,
    openedAt: row.openedAt,
    claimAnswers: row.claimAnswers.map((each) =>
      ClaimAnswer.of({
        claim: each.claim,
        answer: each.answer,
        note: each.note,
        by: UserId.of(each.by),
        at: new Date(each.at),
      }),
    ),
    notMet: row.notMet
      ? NotMetAnswer.of({
          shouldHaveFailed: row.notMet.shouldHaveFailed,
          note: row.notMet.note,
          by: UserId.of(row.notMet.by),
          at: new Date(row.notMet.at),
        })
      : null,
    answeredAt: row.answeredAt,
    withdrawnAt: row.withdrawnAt,
    withdrawnBecause: row.withdrawnBecause,
    version: row.version,
  });

const answerColumnsOf = (stored: JudgeDisagreement) => ({
  claimAnswers: stored.claimAnswers.map((each) => ({
    claim: each.claim,
    answer: each.answer,
    note: each.note,
    by: each.by.value,
    at: each.at.toISOString(),
  })),
  notMet: stored.notMet
    ? {
        shouldHaveFailed: stored.notMet.shouldHaveFailed,
        note: stored.notMet.note,
        by: stored.notMet.by.value,
        at: stored.notMet.at.toISOString(),
      }
    : null,
  answeredAt: stored.answeredAt,
  withdrawnAt: stored.withdrawnAt,
  withdrawnBecause: stored.withdrawnBecause,
});

@Injectable()
export class DrizzleJudgeDisagreementRepository implements JudgeDisagreementRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: JudgeDisagreement): Promise<void> {
    await this.context.inTransaction(async () => {
      const { location, verdict } = added;
      const written = await this.context.db
        .insert(judgeDisagreement)
        .values({
          id: added.id.value,
          runId: added.runId.value,
          workspaceId: added.workspaceId.value,
          teamId: location.teamId.value,
          lineId: location.lineId.value,
          stationId: location.stationId.value,
          taskId: location.taskId.value,
          scoreId: verdict.scoreId.value,
          rubricVersion: verdict.rubricVersion,
          claims: [...verdict.claims],
          claimResults: [...verdict.claimResults],
          reasons: verdict.reasons.map(storedReasonOf),
          labelFrom: added.labelFrom,
          askedOfId: added.askedOf?.value ?? null,
          openedAt: added.openedAt,
          version: added.version,
          ...answerColumnsOf(added),
        })
        .onConflictDoNothing()
        .returning({ id: judgeDisagreement.id });

      if (written.length === 0) {
        throw new JudgeDisagreementVersionConflictError(added.id.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: JudgeDisagreement): Promise<void> {
    await this.context.inTransaction(async () => {
      const matches = and(
        eq(judgeDisagreement.id, saved.id.value),
        eq(judgeDisagreement.version, saved.version),
      );
      const written = saved.isDeleted
        ? await this.context.db
            .delete(judgeDisagreement)
            .where(matches)
            .returning({ id: judgeDisagreement.id })
        : await this.context.db
            .update(judgeDisagreement)
            .set({ version: saved.version + 1, ...answerColumnsOf(saved) })
            .where(matches)
            .returning({ id: judgeDisagreement.id });

      if (written.length === 0) {
        throw new JudgeDisagreementVersionConflictError(saved.id.value);
      }

      if (!saved.isDeleted) {
        await this.events.dispatch(saved.pullEvents());
      }
    });
  }

  async find(id: JudgeDisagreementId): Promise<JudgeDisagreement | null> {
    const [row] = await this.context.db
      .select()
      .from(judgeDisagreement)
      .where(eq(judgeDisagreement.id, id.value))
      .limit(1);

    return row ? toDisagreement(row) : null;
  }

  async ofRun(runId: RunId): Promise<readonly JudgeDisagreement[]> {
    const rows = await this.context.db
      .select()
      .from(judgeDisagreement)
      .where(eq(judgeDisagreement.runId, runId.value))
      .orderBy(desc(judgeDisagreement.openedAt));

    return rows.map(toDisagreement);
  }

  async standing(
    after: JudgeDisagreementId | null,
    max: number,
  ): Promise<readonly JudgeDisagreement[]> {
    const rows = await this.context.db
      .select()
      .from(judgeDisagreement)
      .where(
        and(
          isNull(judgeDisagreement.withdrawnAt),
          after ? gt(judgeDisagreement.id, after.value) : undefined,
        ),
      )
      .orderBy(judgeDisagreement.id)
      .limit(max);

    return rows.map(toDisagreement);
  }

  async outdatedAtStation(
    stationId: StationId,
    current: RubricVersion | null,
    max: number,
  ): Promise<readonly JudgeDisagreement[]> {
    const rows = await this.context.db
      .select()
      .from(judgeDisagreement)
      .where(
        and(
          eq(judgeDisagreement.stationId, stationId.value),
          isNull(judgeDisagreement.withdrawnAt),
          current ? ne(judgeDisagreement.rubricVersion, current) : undefined,
        ),
      )
      .orderBy(judgeDisagreement.openedAt, judgeDisagreement.id)
      .limit(max);

    return rows.map(toDisagreement);
  }

  async answeredAt(
    criteria: AnsweredDisagreements,
  ): Promise<readonly JudgeDisagreement[]> {
    const rows = await this.context.db
      .select()
      .from(judgeDisagreement)
      .where(
        and(
          eq(judgeDisagreement.stationId, criteria.stationId.value),
          eq(judgeDisagreement.rubricVersion, criteria.rubricVersion),
          isNull(judgeDisagreement.withdrawnAt),
          criteria.since
            ? gt(judgeDisagreement.answeredAt, criteria.since)
            : isNotNull(judgeDisagreement.answeredAt),
        ),
      )
      .orderBy(desc(judgeDisagreement.answeredAt))
      .limit(MAX_ANSWERED);

    return rows.map(toDisagreement);
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly JudgeDisagreement[]> {
    const rows = await this.context.db
      .select()
      .from(judgeDisagreement)
      .where(inScope(judgeDisagreement, scope))
      .limit(max);

    return rows.map(toDisagreement);
  }
}
