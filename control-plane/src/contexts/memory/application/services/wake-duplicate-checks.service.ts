import type { SettledSession } from '@memory/application/ports/memory-consolidator.port';
import type { ProposalComparerPort } from '@memory/application/ports/proposal-comparer.port';
import { DuplicateCheckVersionConflictError } from '@memory/domain/exceptions/duplicate-check-version-conflict.error';
import type { DuplicateCheckRepository } from '@memory/domain/repositories/duplicate-check.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

/**
 * Makes the duplicate check that waits for its session due now, once the session settles, instead of at its next
 * look. A check that someone saved meanwhile is at work already, so a version conflict wakes nothing.
 */
export class WakeDuplicateChecks {
  constructor(
    private readonly comparer: ProposalComparerPort,
    private readonly checks: DuplicateCheckRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async settled(session: SettledSession): Promise<void> {
    const runId = this.comparer.runOf(session);

    if (!runId) {
      return;
    }

    try {
      await this.transaction.inTransaction(async () => {
        const check = await this.checks.of(runId);
        const woken = check?.wake(this.clock.now());

        if (check && woken && woken !== check) {
          await this.checks.save(woken);
        }
      });
    } catch (error) {
      if (error instanceof DuplicateCheckVersionConflictError) {
        return;
      }
      throw error;
    }
  }
}
