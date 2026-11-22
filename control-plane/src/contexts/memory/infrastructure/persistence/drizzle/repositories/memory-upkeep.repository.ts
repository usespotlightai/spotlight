import { MemoryUpkeep } from '@memory/domain/aggregates/memory-upkeep.aggregate';
import { MemoryUpkeepSchedule } from '@memory/domain/aggregates/memory-upkeep-schedule.aggregate';
import { UpkeepProposal } from '@memory/domain/entities/upkeep-proposal.entity';
import { MemoryUpkeepScheduleVersionConflictError } from '@memory/domain/exceptions/memory-upkeep-schedule-version-conflict.error';
import { MemoryUpkeepVersionConflictError } from '@memory/domain/exceptions/memory-upkeep-version-conflict.error';
import type {
  MemoryUpkeepRepository,
  MemoryUpkeepScheduleRepository,
} from '@memory/domain/repositories/memory-upkeep.repository';
import type { UpkeepHistory } from '@memory/domain/services/held-back';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import {
  memoryUpkeep,
  memoryUpkeepProposal,
  memoryUpkeepSchedule,
} from '@memory/infrastructure/persistence/drizzle/schemas/memory.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';

type UpkeepRow = typeof memoryUpkeep.$inferSelect;
type ProposalRow = typeof memoryUpkeepProposal.$inferSelect;
type ScheduleRow = typeof memoryUpkeepSchedule.$inferSelect;

const decisionOf = (row: ProposalRow): MemoryDecision | null => {
  if ((row.decidedById === null) !== (row.decidedAt === null)) {
    throw new InconsistentStateError(
      'memory upkeep proposal',
      'has half a decision',
    );
  }

  return row.decidedById && row.decidedAt
    ? MemoryDecision.of({ by: UserId.of(row.decidedById), at: row.decidedAt })
    : null;
};

const proposalOf = (row: ProposalRow): UpkeepProposal =>
  UpkeepProposal.rehydrate({
    id: UpkeepProposalId.of(row.id),
    change: row.change,
    finding: row.finding,
    memories: row.memoryIds.map((each) => MemoryId.of(each)),
    body: row.body === null ? null : MemoryBody.of(row.body),
    reason: row.reason,
    state: row.state,
    decision: decisionOf(row),
  });

const proposalRows = (upkeep: MemoryUpkeep) =>
  upkeep.proposals.map(
    (each, position) =>
      ({
        upkeepId: upkeep.id.value,
        id: each.id.value,
        position,
        change: each.change,
        finding: each.finding,
        memoryIds: each.memories.map((memory) => memory.value),
        body: each.body?.value ?? null,
        reason: each.reason,
        state: each.state,
        decidedById: each.decision?.by.value ?? null,
        decidedAt: each.decision?.at ?? null,
      }) satisfies typeof memoryUpkeepProposal.$inferInsert,
  );

const scheduleOf = (row: ScheduleRow): MemoryUpkeepSchedule =>
  MemoryUpkeepSchedule.rehydrate({
    teamId: TeamId.of(row.teamId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    dueAt: row.dueAt,
    addedSince: row.addedSince,
    job: PendingJob.rehydrate({
      attempts: row.jobAttempts,
      nextAttemptAt: row.jobDueAt,
    }),
    version: row.version,
  });

const scheduleColumns = (schedule: MemoryUpkeepSchedule) => ({
  workspaceId: schedule.workspaceId.value,
  dueAt: schedule.dueAt,
  addedSince: schedule.addedSince,
  jobAttempts: schedule.job.attempts,
  jobDueAt: schedule.job.nextAttemptAt,
});

@Injectable()
export class DrizzleMemoryUpkeepRepository implements MemoryUpkeepRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: MemoryUpkeep): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db.insert(memoryUpkeep).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        teamId: added.teamId.value,
        sweptAt: added.sweptAt,
        version: added.version,
      });
      await this.proposalsReplaced(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: MemoryUpkeep): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(memoryUpkeep)
        .set({ version: saved.version + 1 })
        .where(
          and(
            eq(memoryUpkeep.id, saved.id.value),
            eq(memoryUpkeep.version, saved.version),
          ),
        )
        .returning({ id: memoryUpkeep.id });

      if (written.length === 0) {
        throw new MemoryUpkeepVersionConflictError(saved.id.value);
      }

      await this.proposalsReplaced(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: MemoryUpkeepId): Promise<MemoryUpkeep | null> {
    const [row] = await this.context.db
      .select()
      .from(memoryUpkeep)
      .where(eq(memoryUpkeep.id, id.value));

    return row ? this.withProposals(row) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly MemoryUpkeep[]> {
    const rows = await this.context.db
      .select()
      .from(memoryUpkeep)
      .where(eq(memoryUpkeep.teamId, teamId.value));

    const upkeeps: MemoryUpkeep[] = [];
    for (const row of rows) {
      upkeeps.push(await this.withProposals(row));
    }
    return upkeeps;
  }

  async remove(removed: MemoryUpkeep): Promise<void> {
    const deleted = await this.context.db
      .delete(memoryUpkeep)
      .where(
        and(
          eq(memoryUpkeep.id, removed.id.value),
          eq(memoryUpkeep.version, removed.version),
        ),
      )
      .returning({ id: memoryUpkeep.id });

    if (deleted.length === 0) {
      throw new MemoryUpkeepVersionConflictError(removed.id.value);
    }
  }

  async historySince(
    teamId: TeamId,
    since: Date,
  ): Promise<readonly UpkeepHistory[]> {
    const rows = await this.context.db
      .select({
        memoryIds: memoryUpkeepProposal.memoryIds,
        finding: memoryUpkeepProposal.finding,
        state: memoryUpkeepProposal.state,
        decidedAt: memoryUpkeepProposal.decidedAt,
      })
      .from(memoryUpkeepProposal)
      .innerJoin(memoryUpkeep, eq(memoryUpkeep.id, memoryUpkeepProposal.upkeepId))
      .where(
        and(
          eq(memoryUpkeep.teamId, teamId.value),
          or(
            isNull(memoryUpkeepProposal.decidedAt),
            gte(memoryUpkeepProposal.decidedAt, since),
          ),
        ),
      );

    return rows.map((row) => ({
      ...row,
      memoryIds: row.memoryIds.map((each) => MemoryId.of(each)),
    }));
  }

  private async withProposals(row: UpkeepRow): Promise<MemoryUpkeep> {
    const proposals = await this.context.db
      .select()
      .from(memoryUpkeepProposal)
      .where(eq(memoryUpkeepProposal.upkeepId, row.id))
      .orderBy(asc(memoryUpkeepProposal.position));

    return MemoryUpkeep.rehydrate({
      id: MemoryUpkeepId.of(row.id),
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      sweptAt: row.sweptAt,
      proposals: proposals.map(proposalOf),
      version: row.version,
    });
  }

  private async proposalsReplaced(upkeep: MemoryUpkeep): Promise<void> {
    await this.context.db
      .delete(memoryUpkeepProposal)
      .where(eq(memoryUpkeepProposal.upkeepId, upkeep.id.value));

    const rows = proposalRows(upkeep);

    if (rows.length > 0) {
      await this.context.db.insert(memoryUpkeepProposal).values(rows);
    }
  }
}

@Injectable()
export class DrizzleMemoryUpkeepScheduleRepository
  implements MemoryUpkeepScheduleRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async ofTeam(teamId: TeamId): Promise<MemoryUpkeepSchedule | null> {
    const [row] = await this.context.db
      .select()
      .from(memoryUpkeepSchedule)
      .where(eq(memoryUpkeepSchedule.teamId, teamId.value));

    return row ? scheduleOf(row) : null;
  }

  async ofTeamLocked(teamId: TeamId): Promise<MemoryUpkeepSchedule | null> {
    const [row] = await this.context.db
      .select()
      .from(memoryUpkeepSchedule)
      .where(eq(memoryUpkeepSchedule.teamId, teamId.value))
      .for('share');

    return row ? scheduleOf(row) : null;
  }

  async add(added: MemoryUpkeepSchedule): Promise<void> {
    const [inserted] = await this.context.db
      .insert(memoryUpkeepSchedule)
      .values({
        teamId: added.teamId.value,
        version: added.version,
        ...scheduleColumns(added),
      })
      .onConflictDoNothing({ target: memoryUpkeepSchedule.teamId })
      .returning({ teamId: memoryUpkeepSchedule.teamId });

    if (!inserted) {
      throw new MemoryUpkeepScheduleVersionConflictError(added.teamId.value);
    }
  }

  async save(saved: MemoryUpkeepSchedule): Promise<void> {
    const written = await this.context.db
      .update(memoryUpkeepSchedule)
      .set({ version: saved.version + 1, ...scheduleColumns(saved) })
      .where(
        and(
          eq(memoryUpkeepSchedule.teamId, saved.teamId.value),
          eq(memoryUpkeepSchedule.version, saved.version),
        ),
      )
      .returning({ teamId: memoryUpkeepSchedule.teamId });

    if (written.length === 0) {
      throw new MemoryUpkeepScheduleVersionConflictError(saved.teamId.value);
    }
  }

  async remove(removed: MemoryUpkeepSchedule): Promise<void> {
    const deleted = await this.context.db
      .delete(memoryUpkeepSchedule)
      .where(
        and(
          eq(memoryUpkeepSchedule.teamId, removed.teamId.value),
          eq(memoryUpkeepSchedule.version, removed.version),
        ),
      )
      .returning({ teamId: memoryUpkeepSchedule.teamId });

    if (deleted.length === 0) {
      throw new MemoryUpkeepScheduleVersionConflictError(removed.teamId.value);
    }
  }

  async nextDue(now: Date): Promise<MemoryUpkeepSchedule | null> {
    const [row] = await this.context.db
      .select()
      .from(memoryUpkeepSchedule)
      .where(
        and(
          lte(memoryUpkeepSchedule.dueAt, now),
          or(
            isNull(memoryUpkeepSchedule.jobDueAt),
            lte(memoryUpkeepSchedule.jobDueAt, now),
          ),
        ),
      )
      .orderBy(asc(memoryUpkeepSchedule.dueAt))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? scheduleOf(row) : null;
  }
}
