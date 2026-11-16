import type { RunnerClaimantsPort } from '@runners/application/ports/runner-claimants.port';
import type { RenewReviewWorkLeaseCommand } from '@runs/application/commands/runner.commands';
import type {
  ReviewWorkLeaseRenewal,
  ReviewWorkPort,
} from '@runs/application/ports/review-work.port';
import { UnknownRunnerError } from '@runs/domain/exceptions/unknown-runner.error';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { ReviewWorkId } from '@shared-kernel/domain/value-objects/review-work-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RenewReviewWorkLeaseHandler implements CommandHandlerPort<
  RenewReviewWorkLeaseCommand,
  ReviewWorkLeaseRenewal
> {
  constructor(
    private readonly reviewWork: ReviewWorkPort,
    private readonly claimants: RunnerClaimantsPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: RenewReviewWorkLeaseCommand,
  ): Promise<ReviewWorkLeaseRenewal> {
    try {
      const renewing = RunnerId.of(command.runnerId);
      const at = this.clock.now();

      if (!(await this.claimants.claimantOf(renewing, at))) {
        throw new UnknownRunnerError(command.runnerId);
      }

      const { work } = command;

      return await this.reviewWork.renewLease(
        work.kind === 'check'
          ? {
              kind: 'check',
              id: ReviewWorkId.of(work.stackId),
              recheck: work.recheck,
            }
          : { kind: 'diff', id: ReviewWorkId.of(work.diffId) },
        renewing,
        at,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
