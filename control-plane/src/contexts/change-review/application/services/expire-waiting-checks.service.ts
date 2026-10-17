import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { OwedWorkPort } from '@shared-kernel/application/ports/owed-work.port';

const MAX_AT_ONCE = 50;

export class ExpireWaitingChecks implements OwedWorkPort {
  readonly name = 'Expiring change stack checks nobody claimed in time';

  constructor(
    private readonly checks: StackCheckRepository,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async workDue(): Promise<void> {
    const now = this.clock.now();

    for (const check of await this.checks.withExpiredWait(now, MAX_AT_ONCE)) {
      if (!check.waitExpiredAt(now)) {
        continue;
      }

      try {
        await this.checks.save(check.expireWait(now));
      } catch (error) {
        if (!(error instanceof StackCheckVersionConflictError)) {
          this.logger.error(
            { err: error, stack: check.stackId.value },
            this.name,
          );
        }
      }
    }
  }
}
