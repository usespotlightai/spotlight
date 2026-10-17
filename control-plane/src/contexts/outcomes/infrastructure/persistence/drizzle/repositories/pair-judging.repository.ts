import { Inject, Injectable } from '@nestjs/common';
import { PairJudging } from '@outcomes/domain/aggregates/pair-judging.aggregate';
import { PairJudgingVersionConflictError } from '@outcomes/domain/exceptions/pair-judging-version-conflict.error';
import type { PairJudgingRepository } from '@outcomes/domain/repositories/pair-judging.repository';
import { JudgeCriteria } from '@outcomes/domain/value-objects/judge-criteria.vo';
import { JudgingFailure } from '@outcomes/domain/value-objects/judging-failure.vo';
import { pairJudging } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
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

type Row = typeof pairJudging.$inferSelect;

const failureOf = (row: Row): JudgingFailure | null => {
  if ((row.failure === null) !== (row.failedAt === null)) {
    throw new InconsistentStateError(
      'pair judging',
      'failed without saying when, or says when without a failure',
    );
  }

  return row.failure && row.failedAt
    ? JudgingFailure.of(row.failure, row.failedAt)
    : null;
};

const toPairJudging = (row: Row): PairJudging =>
  PairJudging.rehydrate({
    runId: RunId.of(row.runId),
    against: RunId.of(row.againstRunId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    teamId: TeamId.of(row.teamId),
    criteria: JudgeCriteria.of({
      rubric: row.rubric,
      claims: row.claims,
      passShare: row.passShare,
    }),
    reference: RunId.of(row.referenceRunId),
    maxAttempts: row.maxAttempts,
    order: row.shownOrder,
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

const columnsOf = (stored: PairJudging) => ({
  owed: stored.work !== null,
  workAttempts: stored.work?.attempts ?? 0,
  workDueAt: stored.work?.dueAt ?? null,
  judgedAt: stored.judgedAt,
  failure: stored.failure?.code ?? null,
  failedAt: stored.failure?.at ?? null,
  spent: {
    calls: stored.spent.calls,
    inputTokens: stored.spent.inputTokens,
    outputTokens: stored.spent.outputTokens,
    costs: stored.spent.costs.map((each) => ({ ...each })),
    unpriced: stored.spent.unpriced,
  },
});

@Injectable()
export class DrizzlePairJudgingRepository implements PairJudgingRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: PairJudging): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(pairJudging)
        .values({
          runId: added.runId.value,
          againstRunId: added.against.value,
          workspaceId: added.workspaceId.value,
          teamId: added.teamId.value,
          rubric: added.criteria.rubric,
          claims: [...added.criteria.claims],
          passShare: added.criteria.passShare,
          referenceRunId: added.reference.value,
          maxAttempts: added.maxAttempts,
          shownOrder: added.order,
          askedAt: added.askedAt,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing({
          target: [pairJudging.runId, pairJudging.againstRunId],
        })
        .returning({ runId: pairJudging.runId });

      if (written.length === 0) {
        throw new PairJudgingVersionConflictError(
          added.runId.value,
          added.against.value,
        );
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: PairJudging): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(pairJudging)
        .set({ version: saved.version + 1, ...columnsOf(saved) })
        .where(
          and(
            eq(pairJudging.runId, saved.runId.value),
            eq(pairJudging.againstRunId, saved.against.value),
            eq(pairJudging.version, saved.version),
          ),
        )
        .returning({ runId: pairJudging.runId });

      if (written.length === 0) {
        throw new PairJudgingVersionConflictError(
          saved.runId.value,
          saved.against.value,
        );
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async of(runId: RunId, against: RunId): Promise<PairJudging | null> {
    const [row] = await this.context.db
      .select()
      .from(pairJudging)
      .where(
        and(
          eq(pairJudging.runId, runId.value),
          eq(pairJudging.againstRunId, against.value),
        ),
      )
      .limit(1);

    return row ? toPairJudging(row) : null;
  }

  async dueForWork(now: Date): Promise<PairJudging | null> {
    const [row] = await this.context.db
      .select()
      .from(pairJudging)
      .where(
        and(
          eq(pairJudging.owed, true),
          or(isNull(pairJudging.workDueAt), lte(pairJudging.workDueAt, now)),
        ),
      )
      .orderBy(asc(pairJudging.askedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toPairJudging(row) : null;
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(pairJudging)
      .where(
        and(
          eq(pairJudging.workspaceId, workspaceId.value),
          eq(pairJudging.teamId, teamId.value),
        ),
      );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(pairJudging)
      .where(eq(pairJudging.workspaceId, workspaceId.value));
  }
}
