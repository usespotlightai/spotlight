import { Inject, Injectable } from '@nestjs/common';
import { ChangeJudging } from '@outcomes/domain/aggregates/change-judging.aggregate';
import { ChangeJudgingVersionConflictError } from '@outcomes/domain/exceptions/change-judging-version-conflict.error';
import type { ChangeJudgingRepository } from '@outcomes/domain/repositories/change-judging.repository';
import { JudgeCriteria } from '@outcomes/domain/value-objects/judge-criteria.vo';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import {
  isJudgingRound,
  type JudgingRound,
} from '@outcomes/domain/value-objects/judging-round';
import { changeJudging } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';
import { OwedWork } from '@shared-kernel/domain/value-objects/owed-work.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNull, lte, or } from 'drizzle-orm';

type Row = typeof changeJudging.$inferSelect;

const failureOf = (row: Row): JudgingFailure | null => {
  if ((row.failure === null) !== (row.failedAt === null)) {
    throw new InconsistentStateError(
      'change judging',
      'failed without saying when, or says when without a failure',
    );
  }

  return row.failure && row.failedAt
    ? JudgingFailure.of(row.failure, row.failedAt)
    : null;
};

const roundOf = (row: Row): JudgingRound => {
  if (!isJudgingRound(row.round)) {
    throw new InconsistentStateError(
      'change judging',
      `is in a round no longer known, ${row.round}`,
    );
  }

  return row.round;
};

const toChangeJudging = (row: Row): ChangeJudging =>
  ChangeJudging.rehydrate({
    runId: RunId.of(row.runId),
    round: roundOf(row),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    criteria: JudgeCriteria.of({
      rubric: row.rubric,
      claims: row.claims,
      passShare: row.passShare,
    }),
    reference: row.referenceRunId ? RunId.of(row.referenceRunId) : null,
    askedAt: row.askedAt,
    work: row.owed
      ? OwedWork.rehydrate({
          attempts: row.workAttempts,
          dueAt: row.workDueAt,
        })
      : null,
    judgedAt: row.judgedAt,
    failure: failureOf(row),
    spent: ModelUsage.rehydrate(row.spent),
    version: row.version,
  });

const columnsOf = (held: ChangeJudging) => ({
  owed: held.work !== null,
  workAttempts: held.work?.attempts ?? 0,
  workDueAt: held.work?.dueAt ?? null,
  judgedAt: held.judgedAt,
  failure: held.failure?.code ?? null,
  failedAt: held.failure?.at ?? null,
  spent: {
    calls: held.spent.calls,
    inputTokens: held.spent.inputTokens,
    outputTokens: held.spent.outputTokens,
    costs: held.spent.costs.map((each) => ({ ...each })),
    unpriced: held.spent.unpriced,
  },
});

@Injectable()
export class DrizzleChangeJudgingRepository implements ChangeJudgingRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: ChangeJudging): Promise<void> {
    await this.context.run(async () => {
      const written = await this.context.db
        .insert(changeJudging)
        .values({
          runId: added.runId.value,
          round: added.round,
          workspaceId: added.workspaceId.value,
          teamId: added.teamId.value,
          rubric: added.criteria.rubric,
          claims: [...added.criteria.claims],
          passShare: added.criteria.passShare,
          referenceRunId: added.reference?.value ?? null,
          askedAt: added.askedAt,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing({
          target: [changeJudging.runId, changeJudging.round],
        })
        .returning({ runId: changeJudging.runId });

      if (written.length === 0) {
        throw new ChangeJudgingVersionConflictError(added.runId.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: ChangeJudging): Promise<void> {
    await this.context.run(async () => {
      const written = await this.context.db
        .update(changeJudging)
        .set({ version: saved.version + 1, ...columnsOf(saved) })
        .where(
          and(
            eq(changeJudging.runId, saved.runId.value),
            eq(changeJudging.round, saved.round),
            eq(changeJudging.version, saved.version),
          ),
        )
        .returning({ runId: changeJudging.runId });

      if (written.length === 0) {
        throw new ChangeJudgingVersionConflictError(saved.runId.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async of(runId: RunId, round: JudgingRound): Promise<ChangeJudging | null> {
    const [row] = await this.context.db
      .select()
      .from(changeJudging)
      .where(
        and(
          eq(changeJudging.runId, runId.value),
          eq(changeJudging.round, round),
        ),
      )
      .limit(1);

    return row ? toChangeJudging(row) : null;
  }

  async dueForWork(now: Date): Promise<ChangeJudging | null> {
    const [row] = await this.context.db
      .select()
      .from(changeJudging)
      .where(
        and(
          eq(changeJudging.owed, true),
          or(
            isNull(changeJudging.workDueAt),
            lte(changeJudging.workDueAt, now),
          ),
        ),
      )
      .orderBy(asc(changeJudging.askedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toChangeJudging(row) : null;
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(changeJudging)
      .where(
        and(
          eq(changeJudging.workspaceId, workspaceId.value),
          eq(changeJudging.teamId, teamId.value),
        ),
      );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(changeJudging)
      .where(eq(changeJudging.workspaceId, workspaceId.value));
  }
}
