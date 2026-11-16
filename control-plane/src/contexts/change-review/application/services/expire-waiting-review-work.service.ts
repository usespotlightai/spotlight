import { PushDiffVersionConflictError } from '@change-review/domain/exceptions/push-diff-version-conflict.error';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import type { PushDiffRepository } from '@change-review/domain/repositories/push-diff.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';

const MAX_AT_ONCE = 50;

export class ExpireWaitingReviewWork implements PendingJobsPort {
  readonly name =
    'Expiring change stack checks and push diffs nobody finished in time';

  constructor(
    private readonly checks: StackCheckRepository,
    private readonly diffs: PushDiffRepository,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    const now = this.clock.now();

    const expired = (await this.checks.waiting())
      .filter((each) => each.waitExpiredAt(now))
      .slice(0, MAX_AT_ONCE);

    for (const check of expired) {
      try {
        await this.checks.save(check.expireWait(now));
      } catch (error) {
        if (!(error instanceof StackCheckVersionConflictError)) {
          this.logger.error(
            { err: error, check: check.id.toString() },
            this.name,
          );
        }
      }
    }

    const diffs = (await this.diffs.waiting())
      .filter((each) => each.waitExpiredAt(now))
      .slice(0, MAX_AT_ONCE);

    for (const diff of diffs) {
      try {
        await this.diffs.save(diff.expireWait(now));
      } catch (error) {
        if (!(error instanceof PushDiffVersionConflictError)) {
          this.logger.error({ err: error, diff: diff.id.value }, this.name);
        }
      }
    }
  }
}
