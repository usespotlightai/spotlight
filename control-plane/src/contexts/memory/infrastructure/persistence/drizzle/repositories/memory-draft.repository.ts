import { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import { MemoryDraftMovedOnError } from '@memory/domain/exceptions/memory-draft-moved-on.error';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import { MemoryDrafting } from '@memory/domain/value-objects/memory-drafting.vo';
import { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import {
  memoryDraft,
  memoryProposal,
} from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
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
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNotNull, isNull, lte, or } from 'drizzle-orm';

type DraftRow = typeof memoryDraft.$inferSelect;
type ProposalRow = typeof memoryProposal.$inferSelect;

const draftingOf = (row: DraftRow): MemoryDrafting | null => {
  if (!row.draftingRunId) {
    return null;
  }
  if (!row.draftingAskedAt) {
    throw new InconsistentStateError(
      'memory draft',
      'drafts a run without saying when it was asked',
    );
  }

  return MemoryDrafting.rehydrate({
    runId: RunId.of(row.draftingRunId),
    askedAt: row.draftingAskedAt,
    work: OwedWork.rehydrate({
      attempts: row.workAttempts,
      dueAt: row.workDueAt,
    }),
  });
};

const failureOf = (row: DraftRow): MemoryDraftingFailure | null => {
  if ((row.failure === null) !== (row.failedAt === null)) {
    throw new InconsistentStateError(
      'memory draft',
      'failed without saying when, or says when without a failure',
    );
  }

  return row.failure && row.failedAt
    ? MemoryDraftingFailure.of(row.failure, row.failedAt)
    : null;
};

const toProposal = (row: ProposalRow): MemoryProposal =>
  MemoryProposal.rehydrate({
    id: MemoryId.of(row.id),
    kind: row.kind,
    body: MemoryBody.of(row.body),
    scope: MemoryScope.of({
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
      repository: row.repository ? Repository.of(row.repository) : null,
      paths: row.paths.map(MemoryPath.of),
    }),
    grounds: MemoryGrounds.of({
      taskId: TaskId.of(row.taskId),
      runId: RunId.of(row.runId),
      steps: row.steps,
      notes: row.notes,
    }),
    source: row.source,
    origin: row.origin,
    supersedes: row.supersedes ? MemoryId.of(row.supersedes) : null,
    recordedAt: row.recordedAt,
    state: row.state,
    decision:
      row.decidedBy && row.decidedAt
        ? MemoryDecision.of({
            by: UserId.of(row.decidedBy),
            at: row.decidedAt,
          })
        : null,
  });

const toDraft = (
  row: DraftRow,
  proposals: readonly ProposalRow[],
): MemoryDraft =>
  MemoryDraft.rehydrate({
    id: MemoryDraftId.of(row.id),
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    drafting: draftingOf(row),
    draftedIn: row.draftedIn ? RunId.of(row.draftedIn) : null,
    notesRead: row.notesRead,
    proposals: [...proposals]
      .sort((a, b) => a.position - b.position)
      .map(toProposal),
    failure: failureOf(row),
    version: row.version,
  });

const columnsOf = (draft: MemoryDraft) => ({
  draftingRunId: draft.drafting?.runId.value ?? null,
  draftingAskedAt: draft.drafting?.askedAt ?? null,
  workAttempts: draft.drafting?.work.attempts ?? 0,
  workDueAt: draft.drafting?.work.dueAt ?? null,
  draftedIn: draft.draftedIn?.value ?? null,
  notesRead: draft.notesRead,
  failure: draft.failure?.code ?? null,
  failedAt: draft.failure?.at ?? null,
});

const proposalRows = (draft: MemoryDraft) =>
  draft.proposals.map((each, position) => ({
    id: each.id.value,
    draftId: draft.id.value,
    position,
    kind: each.kind,
    body: each.body.value,
    teamId: each.scope.teamId.value,
    lineId: each.scope.lineId,
    stationId: each.scope.stationId,
    repository: each.scope.repository?.value ?? null,
    paths: each.scope.paths.map((path) => path.value),
    taskId: each.grounds.taskId.value,
    runId: each.grounds.runId.value,
    steps: [...each.grounds.steps],
    notes: [...each.grounds.notes],
    source: each.source,
    origin: each.origin,
    supersedes: each.supersedes?.value ?? null,
    recordedAt: each.recordedAt,
    state: each.state,
    decidedBy: each.decision?.by.value ?? null,
    decidedAt: each.decision?.at ?? null,
  }));

@Injectable()
export class DrizzleMemoryDraftRepository implements MemoryDraftRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: MemoryDraft): Promise<void> {
    await this.context.run(async () => {
      const written = await this.context.db
        .insert(memoryDraft)
        .values({
          id: added.id.value,
          taskId: added.taskId.value,
          workspaceId: added.workspaceId.value,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing({ target: memoryDraft.taskId })
        .returning({ id: memoryDraft.id });

      if (written.length === 0) {
        throw new MemoryDraftMovedOnError(added.id.value);
      }

      await this.proposalsReplaced(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: MemoryDraft): Promise<void> {
    await this.context.run(async () => {
      const written = await this.context.db
        .update(memoryDraft)
        .set({ version: saved.version + 1, ...columnsOf(saved) })
        .where(
          and(
            eq(memoryDraft.id, saved.id.value),
            eq(memoryDraft.version, saved.version),
          ),
        )
        .returning({ id: memoryDraft.id });

      if (written.length === 0) {
        throw new MemoryDraftMovedOnError(saved.id.value);
      }

      await this.proposalsReplaced(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async proposalsReplaced(draft: MemoryDraft): Promise<void> {
    await this.context.db
      .delete(memoryProposal)
      .where(eq(memoryProposal.draftId, draft.id.value));

    const rows = proposalRows(draft);

    if (rows.length > 0) {
      await this.context.db.insert(memoryProposal).values(rows);
    }
  }

  async forTask(taskId: TaskId): Promise<MemoryDraft | null> {
    const [row] = await this.context.db
      .select()
      .from(memoryDraft)
      .where(eq(memoryDraft.taskId, taskId.value))
      .limit(1);

    return row ? this.withProposals(row) : null;
  }

  async dueForWork(now: Date): Promise<MemoryDraft | null> {
    const [row] = await this.context.db
      .select()
      .from(memoryDraft)
      .where(
        and(
          isNotNull(memoryDraft.draftingRunId),
          or(isNull(memoryDraft.workDueAt), lte(memoryDraft.workDueAt, now)),
        ),
      )
      .orderBy(asc(memoryDraft.draftingAskedAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? this.withProposals(row) : null;
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(memoryDraft)
      .where(eq(memoryDraft.taskId, taskId.value));
  }

  private async withProposals(row: DraftRow): Promise<MemoryDraft> {
    const proposals = await this.context.db
      .select()
      .from(memoryProposal)
      .where(eq(memoryProposal.draftId, row.id));

    return toDraft(row, proposals);
  }
}
