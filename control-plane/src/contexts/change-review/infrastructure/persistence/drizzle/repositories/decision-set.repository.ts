import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import { Decision } from '@change-review/domain/entities/decision.entity';
import { DecisionDispute } from '@change-review/domain/entities/decision-dispute.entity';
import { DecisionSetVersionConflictError } from '@change-review/domain/exceptions/decision-set-version-conflict.error';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import { DecisionDraft } from '@change-review/domain/value-objects/decision-draft.vo';
import { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { DecisionStanding } from '@change-review/domain/value-objects/decision-standing.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import {
  type DecisionSetRow,
  draftedRunOf,
  mergeRowOf,
} from '@change-review/infrastructure/persistence/drizzle/repositories/decision-set.rows';
import {
  decision,
  decisionDispute,
  decisionSet,
} from '@change-review/infrastructure/persistence/drizzle/schemas/decision.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { OwedWork } from '@shared-kernel/domain/value-objects/owed-work.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm';

type DecisionRow = typeof decision.$inferSelect;
type DisputeRow = typeof decisionDispute.$inferSelect;

const draftOf = (row: DecisionSetRow): DecisionDraft | null => {
  const runId = draftedRunOf(row);

  if (!runId) {
    return null;
  }
  if (!row.draftAskedAt) {
    throw new InconsistentStateError(
      'decision set',
      'drafts a run without saying when it was asked',
    );
  }

  return DecisionDraft.rehydrate({
    runId: RunId.of(runId),
    askedAt: row.draftAskedAt,
    work: OwedWork.rehydrate({
      attempts: row.workAttempts,
      dueAt: row.workDueAt,
    }),
  });
};

const standingOf = (row: DecisionSetRow): DecisionStanding => {
  const merge = mergeRowOf(row);

  return DecisionStanding.rehydrate({
    state: row.standing,
    merge: merge
      ? DecisionMerge.rehydrate({
          repository: Repository.of(merge.repository),
          commit: merge.commit,
          at: merge.at,
        })
      : null,
  });
};

const toDecision = (
  row: DecisionRow,
  disputes: readonly DisputeRow[],
): Decision =>
  Decision.rehydrate({
    id: DecisionId.of(row.id),
    kind: row.kind,
    title: row.title,
    why: row.why,
    alternatives: row.alternatives,
    paths: row.paths.map(FilePath.of),
    steps: row.steps,
    disputes: disputes
      .filter((each) => each.decisionId === row.id)
      .map((each) =>
        DecisionDispute.rehydrate({
          id: DecisionDisputeId.of(each.id),
          path: FilePath.of(each.path),
          by: UserId.of(each.byUserId),
          reason: each.reason,
          at: each.at,
        }),
      ),
  });

const toDecisionSet = (
  row: DecisionSetRow,
  decisions: readonly DecisionRow[],
  disputes: readonly DisputeRow[],
): DecisionSet =>
  DecisionSet.rehydrate({
    id: DecisionSetId.of(row.id),
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    decidedIn: row.decidedIn ? RunId.of(row.decidedIn) : null,
    decisions: [...decisions]
      .sort((a, b) => a.position - b.position)
      .map((each) => toDecision(each, disputes)),
    draft: draftOf(row),
    standing: standingOf(row),
    version: row.version,
  });

const columnsOf = (set: DecisionSet) => ({
  decidedIn: set.decidedIn?.value ?? null,
  draftRunId: set.draft?.runId.value ?? null,
  draftAskedAt: set.draft?.askedAt ?? null,
  workAttempts: set.draft?.work.attempts ?? 0,
  workDueAt: set.draft?.work.dueAt ?? null,
  standing: set.standing.state,
  mergedRepository: set.standing.merge?.repository.value ?? null,
  mergedCommit: set.standing.merge?.commit ?? null,
  mergedAt: set.standing.merge?.at ?? null,
});

const decisionRows = (set: DecisionSet) =>
  set.decisions.map((each, position) => ({
    id: each.id.value,
    setId: set.id.value,
    position,
    kind: each.kind,
    title: each.title,
    why: each.why,
    alternatives: [...each.alternatives],
    paths: each.paths.map((path) => path.value),
    steps: [...each.steps],
  }));

@Injectable()
export class DrizzleDecisionSetRepository implements DecisionSetRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: DecisionSet): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db.insert(decisionSet).values({
        id: added.id.value,
        taskId: added.taskId.value,
        workspaceId: added.workspaceId.value,
        version: added.version,
        ...columnsOf(added),
      });
      await this.decisionsReplaced(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: DecisionSet): Promise<void> {
    if (saved.discarded) {
      await this.removed(saved);
      return;
    }

    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(decisionSet)
        .set({ version: saved.version + 1, ...columnsOf(saved) })
        .where(
          and(
            eq(decisionSet.id, saved.id.value),
            eq(decisionSet.version, saved.version),
          ),
        )
        .returning({ id: decisionSet.id });

      if (written.length === 0) {
        throw new DecisionSetVersionConflictError(saved.id.value);
      }

      await this.decisionsReplaced(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async removed(set: DecisionSet): Promise<void> {
    await this.context.inTransaction(async () => {
      const removed = await this.context.db
        .delete(decisionSet)
        .where(
          and(
            eq(decisionSet.id, set.id.value),
            eq(decisionSet.version, set.version),
          ),
        )
        .returning({ id: decisionSet.id });

      if (removed.length === 0) {
        throw new DecisionSetVersionConflictError(set.id.value);
      }

      await this.events.dispatch(set.pullEvents());
    });
  }

  private async decisionsReplaced(set: DecisionSet): Promise<void> {
    await this.context.db
      .delete(decision)
      .where(eq(decision.setId, set.id.value));

    const rows = decisionRows(set);

    if (rows.length > 0) {
      await this.context.db.insert(decision).values(rows);
    }

    const disputes = set.decisions.flatMap((entity) =>
      entity.disputes.map((each) => ({ decisionId: entity.id.value, each })),
    );

    if (disputes.length > 0) {
      await this.context.db.insert(decisionDispute).values(
        disputes.map(({ decisionId, each }) => ({
          id: each.id.value,
          decisionId,
          path: each.path.value,
          byUserId: each.by.value,
          reason: each.reason,
          at: each.at,
        })),
      );
    }
  }

  async forTask(taskId: TaskId): Promise<DecisionSet | null> {
    const [row] = await this.context.db
      .select()
      .from(decisionSet)
      .where(eq(decisionSet.taskId, taskId.value))
      .limit(1);

    return row ? this.withDecisions(row) : null;
  }

  async dueForWork(now: Date): Promise<DecisionSet | null> {
    const [row] = await this.context.db
      .select()
      .from(decisionSet)
      .where(
        and(
          isNotNull(decisionSet.draftRunId),
          or(isNull(decisionSet.workDueAt), lte(decisionSet.workDueAt, now)),
        ),
      )
      .orderBy(asc(decisionSet.draftAskedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? this.withDecisions(row) : null;
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(decisionSet)
      .where(eq(decisionSet.taskId, taskId.value));
  }

  private async withDecisions(row: DecisionSetRow): Promise<DecisionSet> {
    const decisions = await this.context.db
      .select()
      .from(decision)
      .where(eq(decision.setId, row.id));
    const disputes =
      decisions.length > 0
        ? await this.context.db
            .select()
            .from(decisionDispute)
            .where(
              inArray(
                decisionDispute.decisionId,
                decisions.map((each) => each.id),
              ),
            )
            .orderBy(asc(decisionDispute.at))
        : [];

    return toDecisionSet(row, decisions, disputes);
  }
}
