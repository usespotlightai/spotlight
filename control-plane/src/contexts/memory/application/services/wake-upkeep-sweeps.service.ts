import type {
  MemoryConsolidatorPort,
  SettledSession,
} from '@memory/application/ports/memory-consolidator.port';
import { MemoryUpkeepScheduleVersionConflictError } from '@memory/domain/exceptions/memory-upkeep-schedule-version-conflict.error';
import type { MemoryUpkeepScheduleRepository } from '@memory/domain/repositories/memory-upkeep.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

/**
 * Makes the sweep that waits for its consolidation session due now, once the session settles, instead of at its next
 * look. A schedule that someone saved meanwhile is at work already, so a version conflict wakes nothing.
 */
export class WakeUpkeepSweeps {
  constructor(
    private readonly consolidator: MemoryConsolidatorPort,
    private readonly schedules: MemoryUpkeepScheduleRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async settled(session: SettledSession): Promise<void> {
    const round = this.consolidator.roundOf(session);

    if (!round) {
      return;
    }

    try {
      await this.transaction.inTransaction(async () => {
        const schedule = await this.schedules.ofTeam(round.teamId);
        const woken = schedule?.wake(round, this.clock.now());

        if (schedule && woken && woken !== schedule) {
          await this.schedules.save(woken);
        }
      });
    } catch (error) {
      if (error instanceof MemoryUpkeepScheduleVersionConflictError) {
        return;
      }
      throw error;
    }
  }
}
