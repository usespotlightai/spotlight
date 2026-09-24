import type { CheckRunnersPort } from '@change-review/application/ports/check-runners.port';
import type { OwedWorkPort } from '@change-review/application/ports/owed-work.port';
import { ChangedSinceReadError } from '@change-review/domain/exceptions/changed-since-read.error';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const MOST_AT_ONCE = 50;

export class SettleOverdueChecks implements OwedWorkPort {
  readonly name = 'Settling change stack checks nobody took up in time';

  constructor(
    private readonly checks: StackCheckRepository,
    private readonly runners: CheckRunnersPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async workDue(): Promise<void> {
    const now = this.clock.now();

    for (const check of await this.checks.overdue(now, MOST_AT_ONCE)) {
      if (!check.overdueAt(now)) {
        continue;
      }

      try {
        await this.checks.save(check.settledOverdue(now));

        if (check.reservation) {
          await this.runners.reservationDropped(check.reservation.runner);
        }
      } catch (error) {
        if (!(error instanceof ChangedSinceReadError)) {
          this.logger.error(
            { err: error, stack: check.stackId.value },
            this.name,
          );
        }
      }
    }
  }
}
