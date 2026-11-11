import { DecisionSet } from '@change-review/domain/aggregates/decision-set.aggregate';
import { Decision } from '@change-review/domain/entities/decision.entity';
import { DecisionDispute } from '@change-review/domain/entities/decision-dispute.entity';
import { DecisionSetVersionConflictError } from '@change-review/domain/exceptions/decision-set-version-conflict.error';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import { DecisionDisputeId } from '@change-review/domain/value-objects/decision-dispute-id.vo';
import { DecisionGeneration } from '@change-review/domain/value-objects/decision-generation.vo';
import { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import { DecisionMerge } from '@change-review/domain/value-objects/decision-merge.vo';
import { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import { DecisionStatus } from '@change-review/domain/value-objects/decision-status.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import {
  type DecisionSetRow,
  generationRunOf,
  type MergeRow,
} from '@change-review/infrastructure/persistence/drizzle/repositories/decision-set.rows';
import {
  decision,
  decisionDispute,
  decisionSet,
  decisionSetMerge,
} from '@change-review/infrastructure/persistence/drizzle/schemas/decision.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm';

type DecisionRow = typeof decision.$inferSelect;
type DisputeRow = typeof decisionDispute.$inferSelect;

const generationOf = (row: DecisionSetRow): DecisionGeneration | null => {
  const runId = generationRunOf(row);

  if (!runId) {
    return null;
  }
  if (!row.generationRequestedAt) {
    throw new InconsistentStateError(
      'decision set',
      'generates decisions for a run without saying when it was requested',
    );
  }

  return DecisionGeneration.rehydrate({
    runId: RunId.of(runId),
    requestedAt: row.generationRequestedAt,
    job: PendingJob.rehydrate({
      attempts: row.jobAttempts,
      nextAttemptAt: row.jobDueAt,
    }),
  });
};

const statusOf = (
  row: DecisionSetRow,
  merges: readonly MergeRow[],
): DecisionStatus =>
  DecisionStatus.rehydrate({
    state: row.status,
    merges: merges.map((each) =>
      DecisionMerge.rehydrate({
        repository: Repository.of(each.repository),
        commit: each.commit,
        at: each.mergedAt,
      }),
    ),
  });

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
    journalSteps: row.journalSteps,
    disputes: disputes
      .filter((each) => each.decisionId === row.id)
      .map((each) =>
        DecisionDispute.rehydrate({
          id: DecisionDisputeId.of(each.id),
          path: FilePath.of(each.path),
          by: UserId.of(each.disputedById),
          reason: each.reason,
          at: each.at,
        }),
      ),
  });

const toDecisionSet = (
  row: DecisionSetRow,
  decisions: readonly DecisionRow[],
  disputes: readonly DisputeRow[],
  merges: readonly MergeRow[],
): DecisionSet =>
  DecisionSet.rehydrate({
    id: DecisionSetId.of(row.id),
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    sourceRunId: row.sourceRunId ? RunId.of(row.sourceRunId) : null,
    decisions: [...decisions]
      .sort((a, b) => a.position - b.position)
      .map((each) => toDecision(each, disputes)),
    generation: generationOf(row),
    status: statusOf(row, merges),
    version: row.version,
  });

const columnsOf = (set: DecisionSet) => ({
  sourceRunId: set.sourceRunId?.value ?? null,
  generationRunId: set.generation?.runId.value ?? null,
  generationRequestedAt: set.generation?.requestedAt ?? null,
  jobAttempts: set.generation?.job.attempts ?? 0,
  jobDueAt: set.generation?.job.nextAttemptAt ?? null,
  status: set.status.state,
});

const mergeRows = (set: DecisionSet) =>
  set.status.merges.map((each) => ({
    setId: set.id.value,
    repository: each.repository.value,
    commit: each.commit.value,
    mergedAt: each.at,
  }));

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
    journalSteps: [...each.journalSteps],
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
      await this.mergesReplaced(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: DecisionSet): Promise<void> {
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
      await this.mergesReplaced(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  async remove(set: DecisionSet): Promise<void> {
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

  private async mergesReplaced(set: DecisionSet): Promise<void> {
    await this.context.db
      .delete(decisionSetMerge)
      .where(eq(decisionSetMerge.setId, set.id.value));

    const rows = mergeRows(set);

    if (rows.length > 0) {
      await this.context.db.insert(decisionSetMerge).values(rows);
    }
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
          disputedById: each.by.value,
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

  async nextDueJob(now: Date): Promise<DecisionSet | null> {
    const [row] = await this.context.db
      .select()
      .from(decisionSet)
      .where(
        and(
          isNotNull(decisionSet.generationRunId),
          or(isNull(decisionSet.jobDueAt), lte(decisionSet.jobDueAt, now)),
        ),
      )
      .orderBy(asc(decisionSet.generationRequestedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? this.withDecisions(row) : null;
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

    const merges = await this.context.db
      .select()
      .from(decisionSetMerge)
      .where(eq(decisionSetMerge.setId, row.id));

    return toDecisionSet(row, decisions, disputes, merges);
  }
}
