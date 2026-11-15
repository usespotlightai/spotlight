import { PULL_REQUEST_DEADLINE_MS } from '@insights/domain/aggregates/claims-revision.aggregate';
import { ClaimsRevisionVersionConflictError } from '@insights/domain/exceptions/claims-revision-version-conflict.error';
import type { ClaimsRevisionRepository } from '@insights/domain/repositories/claims-revision.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

const MAX_AT_ONCE = 50;

export class EndOverdueClaimsRevisions implements PendingJobsPort {
  readonly name = 'Ending claims revisions that got no pull request in time';

  constructor(
    private readonly revisions: ClaimsRevisionRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async processDue(): Promise<void> {
    const now = this.clock.now();
    const overdue = await this.revisions.pickedBefore(
      new Date(now.getTime() - PULL_REQUEST_DEADLINE_MS),
      MAX_AT_ONCE,
    );

    for (const revision of overdue) {
      try {
        await this.transaction.inTransaction(() =>
          this.revisions.save(revision.pullRequestOverdue(now)),
        );
      } catch (error) {
        if (!(error instanceof ClaimsRevisionVersionConflictError)) {
          this.logger.error(
            { err: error, revision: revision.id.value },
            this.name,
          );
        }
      }
    }
  }
}
