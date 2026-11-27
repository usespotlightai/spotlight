import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import {
  MemoryProposal,
  type Retiring,
} from '@memory/domain/entities/memory-proposal.entity';
import { MemoryProposalSetAlreadyOpenError } from '@memory/domain/exceptions/memory-proposal-set-already-open.error';
import { MemoryProposalSetVersionConflictError } from '@memory/domain/exceptions/memory-proposal-set-version-conflict.error';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import {
  memoryProposalSet,
  memoryProposal,
} from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type ProposalSetRow = typeof memoryProposalSet.$inferSelect;
type ProposalRow = typeof memoryProposal.$inferSelect;

const retiringOf = (row: ProposalRow): Retiring | null => {
  if ((row.retires === null) !== (row.retireReason === null)) {
    throw new InconsistentStateError(
      'memory proposal',
      'retires a memory without saying why, or says why without naming it',
    );
  }

  return row.retires && row.retireReason
    ? { memory: MemoryId.of(row.retires), reason: row.retireReason }
    : null;
};

const toProposal = (row: ProposalRow): MemoryProposal =>
  MemoryProposal.rehydrate({
    id: MemoryId.of(row.id),
    kind: row.kind,
    body: MemoryBody.of(row.body),
    scope: MemoryScope.of({
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId === null ? null : LineId.of(row.lineId),
      stationId: row.stationId === null ? null : StationId.of(row.stationId),
      repository: row.repository ? Repository.of(row.repository) : null,
      paths: row.paths.map(MemoryPath.of),
    }),
    provenance: MemoryProvenance.of({
      taskId: TaskId.of(row.taskId),
      runId: RunId.of(row.runId),
      steps: row.steps,
      notes: row.notes,
      command: row.command,
    }),
    source: row.source,
    supersedes: row.supersedes ? MemoryId.of(row.supersedes) : null,
    retires: retiringOf(row),
    recordedAt: row.recordedAt,
    state: row.state,
    decision:
      row.decidedById && row.decidedAt
        ? MemoryDecision.of({
            by: UserId.of(row.decidedById),
            at: row.decidedAt,
          })
        : null,
  });

const toProposalSet = (
  row: ProposalSetRow,
  proposals: readonly ProposalRow[],
): MemoryProposalSet =>
  MemoryProposalSet.rehydrate({
    id: MemoryProposalSetId.of(row.id),
    taskId: TaskId.of(row.taskId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    proposals: [...proposals]
      .sort((a, b) => a.position - b.position)
      .map(toProposal),
    version: row.version,
  });

const proposalRows = (set: MemoryProposalSet) =>
  set.proposals.map(
    (each, position) =>
      ({
        id: each.id.value,
        setId: set.id.value,
        position,
        kind: each.kind,
        body: each.body.value,
        teamId: each.scope.teamId.value,
        lineId: each.scope.lineId?.value ?? null,
        stationId: each.scope.stationId?.value ?? null,
        repository: each.scope.repository?.value ?? null,
        paths: each.scope.paths.map((path) => path.value),
        taskId: each.provenance.taskId.value,
        runId: each.provenance.runId.value,
        steps: [...each.provenance.steps],
        notes: [...each.provenance.notes],
        command: each.provenance.command ?? null,
        source: each.source,
        supersedes: each.supersedes?.value ?? null,
        retires: each.retires?.memory.value ?? null,
        retireReason: each.retires?.reason ?? null,
        recordedAt: each.recordedAt,
        state: each.state,
        decidedById: each.decision?.by.value ?? null,
        decidedAt: each.decision?.at ?? null,
      }) satisfies typeof memoryProposal.$inferInsert,
  );

@Injectable()
export class DrizzleMemoryProposalSetRepository implements MemoryProposalSetRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: MemoryProposalSet): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(memoryProposalSet)
        .values({
          id: added.id.value,
          taskId: added.taskId.value,
          workspaceId: added.workspaceId.value,
          version: added.version,
        })
        .onConflictDoNothing({ target: memoryProposalSet.taskId })
        .returning({ id: memoryProposalSet.id });

      if (written.length === 0) {
        throw new MemoryProposalSetAlreadyOpenError(added.taskId.value);
      }

      await this.proposalsReplaced(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: MemoryProposalSet): Promise<void> {
    if (saved.isDeleted) {
      return this.removed(saved);
    }

    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(memoryProposalSet)
        .set({ version: saved.version + 1 })
        .where(
          and(
            eq(memoryProposalSet.id, saved.id.value),
            eq(memoryProposalSet.version, saved.version),
          ),
        )
        .returning({ id: memoryProposalSet.id });

      if (written.length === 0) {
        throw new MemoryProposalSetVersionConflictError(saved.id.value);
      }

      await this.proposalsReplaced(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async proposalsReplaced(set: MemoryProposalSet): Promise<void> {
    await this.context.db
      .delete(memoryProposal)
      .where(eq(memoryProposal.setId, set.id.value));

    const rows = proposalRows(set);

    if (rows.length > 0) {
      await this.context.db.insert(memoryProposal).values(rows);
    }
  }

  async forTask(taskId: TaskId): Promise<MemoryProposalSet | null> {
    const [row] = await this.context.db
      .select()
      .from(memoryProposalSet)
      .where(eq(memoryProposalSet.taskId, taskId.value))
      .limit(1);

    return row ? this.withProposals(row) : null;
  }

  async forTaskLocked(taskId: TaskId): Promise<MemoryProposalSet | null> {
    const [row] = await this.context.db
      .select()
      .from(memoryProposalSet)
      .where(eq(memoryProposalSet.taskId, taskId.value))
      .limit(1)
      .for('update');

    return row ? this.withProposals(row) : null;
  }

  private async removed(removed: MemoryProposalSet): Promise<void> {
    const gone = await this.context.db
      .delete(memoryProposalSet)
      .where(
        and(
          eq(memoryProposalSet.id, removed.id.value),
          eq(memoryProposalSet.version, removed.version),
        ),
      )
      .returning({ id: memoryProposalSet.id });

    if (gone.length === 0) {
      throw new MemoryProposalSetVersionConflictError(removed.id.value);
    }
  }

  private async withProposals(row: ProposalSetRow): Promise<MemoryProposalSet> {
    const proposals = await this.context.db
      .select()
      .from(memoryProposal)
      .where(eq(memoryProposal.setId, row.id));

    return toProposalSet(row, proposals);
  }
}
