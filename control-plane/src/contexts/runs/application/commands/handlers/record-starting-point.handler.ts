import type { RunnerClaimantsPort } from '@runners/application/ports/runner-claimants.port';
import type {
  RecordStartingPointCommand,
  ReportedCheckout,
} from '@runs/application/commands/runner.commands';
import type { ArchiveReferenceLocksPort } from '@runs/application/ports/archive-reference-locks.port';
import { InvalidStartingPointError } from '@runs/domain/exceptions/invalid-starting-point.error';
import { UnknownRunError } from '@runs/domain/exceptions/unknown-run.error';
import { UnknownRunnerError } from '@runs/domain/exceptions/unknown-runner.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { WorkingCopyArchiveRepository } from '@runs/domain/repositories/working-copy-archive.repository';
import type { RestoredArchive } from '@runs/domain/value-objects/restored-archive.vo';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { StartedCheckout } from '@runs/domain/value-objects/started-checkout.vo';
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const listed = (
  checkouts: readonly ReportedCheckout[] | null,
): readonly ReportedCheckout[] => {
  if (!checkouts) {
    throw new InvalidStartingPointError('checkouts must be a list');
  }

  return checkouts;
};

export class RecordStartingPointHandler implements CommandHandlerPort<
  RecordStartingPointCommand,
  void
> {
  constructor(
    private readonly runs: RunRepository,
    private readonly archives: WorkingCopyArchiveRepository,
    private readonly claimants: RunnerClaimantsPort,
    private readonly clock: ClockPort,
    private readonly locks: ArchiveReferenceLocksPort,
  ) {}

  async execute(command: RecordStartingPointCommand): Promise<void> {
    try {
      const runner = RunnerId.of(command.runnerId);
      const now = this.clock.now();

      if (!(await this.claimants.claimantOf(runner, now))) {
        throw new UnknownRunnerError(command.runnerId);
      }

      const checkouts = listed(command.checkouts);

      const run = await this.runs.findById(RunId.of(command.runId));

      if (!run) {
        throw new UnknownRunError(`Run ${command.runId} not found.`);
      }

      const attempt = RunAttempt.reported(run.id, command.attempt);

      run.assertStillOn(attempt, runner);

      await this.locks.referencing(run.workspaceId, async () => {
        const restored =
          command.archiveId === null
            ? null
            : await this.restored(WorkingCopyArchiveId.of(command.archiveId));

        await this.runs.save(
          run.startsFrom(
            attempt,
            runner,
            { restored, checkouts: checkouts.map(StartedCheckout.of) },
            now,
          ),
        );
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async restored(id: WorkingCopyArchiveId): Promise<RestoredArchive> {
    const archive = await this.archives.find(id);

    if (!archive) {
      throw new InvalidStartingPointError(
        `names archive ${id.value}, which is not stored`,
      );
    }

    return archive.restored;
  }
}
