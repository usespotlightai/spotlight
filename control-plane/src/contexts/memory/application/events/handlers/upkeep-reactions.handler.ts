import type { UpkeepNoticesPort } from '@memory/application/ports/upkeep-notices.port';
import { MemoryUpkeepSchedule } from '@memory/domain/aggregates/memory-upkeep-schedule.aggregate';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryCreated } from '@memory/domain/events/memory-created.event';
import type { MemoryMerged } from '@memory/domain/events/memory-merged.event';
import type { MemoryUpkeepSettled } from '@memory/domain/events/memory-upkeep-settled.event';
import type { MemoryUpkeepSwept } from '@memory/domain/events/memory-upkeep-swept.event';
import type { UpkeepProposalApproved } from '@memory/domain/events/upkeep-proposal-approved.event';
import type {
  MemoryUpkeepRepository,
  MemoryUpkeepScheduleRepository,
} from '@memory/domain/repositories/memory-upkeep.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import {
  inactiveOf,
  whyMergeNoLongerApplies,
} from '@memory/domain/services/memory-lapse';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class UpkeepReactions {
  constructor(
    private readonly notices: UpkeepNoticesPort,
    private readonly memories: MemoryRepository,
    private readonly upkeeps: MemoryUpkeepRepository,
    private readonly schedules: MemoryUpkeepScheduleRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async onSwept(event: MemoryUpkeepSwept): Promise<void> {
    if (!(await this.upkeeps.find(event.upkeepId))?.awaitsDecision) {
      return;
    }

    await this.notices.swept(event);

    if (!(await this.upkeeps.find(event.upkeepId))?.awaitsDecision) {
      await this.notices.settled(event.upkeepId, event.teamId);
    }
  }

  onSettled(event: MemoryUpkeepSettled): Promise<void> {
    return this.notices.settled(event.upkeepId, event.teamId);
  }

  async onApproved(event: UpkeepProposalApproved): Promise<void> {
    const applied = await this.transaction.inTransaction(() =>
      event.change === 'merge' ? this.merged(event) : this.retired(event),
    );

    if (!applied) {
      await this.transaction.inTransaction(async () => {
        const upkeep = await this.upkeeps.find(event.upkeepId);
        const proposal = upkeep?.proposal(event.proposalId);

        if (upkeep && proposal?.state === 'approved') {
          await this.upkeeps.save(upkeep.lapse(event.proposalId));
        }
      });
    }
  }

  onMerged(event: MemoryMerged): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const locked = await this.memories.findAllLocked([
        event.memoryId,
        ...event.replaces,
      ]);
      const merged = locked.find((each) => each.id.equals(event.memoryId));

      if (!merged?.isActive) {
        return;
      }

      const replaced = locked.filter((each) => !each.id.equals(event.memoryId));
      const reason = whyMergeNoLongerApplies(
        event.replaces.filter(
          (id) => !replaced.find((each) => each.id.equals(id))?.isActive,
        ),
        replaced,
        event.memoryId,
      );

      if (reason) {
        await this.memories.save(
          merged.retire({
            by: event.decision.by,
            reason,
            at: this.clock.now(),
          }),
        );
        return;
      }

      for (const each of replaced.filter((memory) => memory.isActive)) {
        await this.memories.save(
          each.supersedeWith(event.memoryId, event.decision.at),
        );
      }
    });
  }

  async onCreated(event: MemoryCreated): Promise<void> {
    if (event.creation !== 'added') {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const [created] = await this.memories.findAllLocked([event.memoryId]);

      if (!created) {
        return;
      }

      const now = this.clock.now();
      const schedule = await this.schedules.ofTeam(event.teamId);

      if (!schedule) {
        await this.schedules.add(
          MemoryUpkeepSchedule.first({
            teamId: event.teamId,
            workspaceId: event.workspaceId,
            now,
          }).memoryAdded(now),
        );
        return;
      }

      const counted = schedule.memoryAdded(now);
      if (counted !== schedule) {
        await this.schedules.save(counted);
      }
    });
  }

  private async current(event: UpkeepProposalApproved) {
    const found = await this.memories.findAll(event.memories);
    const upkeep = await this.upkeeps.find(event.upkeepId);
    const proposal = upkeep?.proposal(event.proposalId);

    return proposal &&
      inactiveOf(proposal.memories, found, event.teamId).length === 0
      ? event.memories.flatMap((id) =>
          found.filter((each) => each.id.equals(id)),
        )
      : null;
  }

  private async retired(event: UpkeepProposalApproved): Promise<boolean> {
    const [named] = await this.memories.findAll(event.memories);

    if (
      named?.retiredAs({
        by: event.decision.by,
        reason: event.reason,
        at: event.decision.at,
      })
    ) {
      return true;
    }

    const [retired] = (await this.current(event)) ?? [];

    if (!retired) {
      return false;
    }

    await this.memories.save(
      retired.retire({
        by: event.decision.by,
        reason: event.reason,
        at: event.decision.at,
      }),
    );
    return true;
  }

  private async merged(event: UpkeepProposalApproved): Promise<boolean> {
    const { merged, body } = event;

    if (!merged || !body) {
      throw new InconsistentStateError(
        'memory upkeep',
        'approved a merge without the memory it writes',
      );
    }
    if (await this.memories.find(merged)) {
      return true;
    }

    const replaced = await this.current(event);
    const first = replaced?.[0];

    if (!replaced || !first) {
      return false;
    }

    await this.memories.add(
      Memory.merged({
        id: merged,
        handle: await this.memories.nextHandle(),
        body,
        replacing: replaced,
        by: event.decision,
      }),
    );
    return true;
  }
}
