import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  RecordStartingPointCommand,
  ReportedCheckout,
} from '@work/application/commands/runner.commands';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { InvalidStartingPointError } from '@work/domain/exceptions/invalid-starting-point.error';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import { UnknownRunnerError } from '@work/domain/exceptions/unknown-runner.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { WorkspaceArchiveRepository } from '@work/domain/repositories/workspace-archive.repository';
import type { RestoredArchive } from '@work/domain/value-objects/restored-archive.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import { MOST_STARTED_CHECKOUTS } from '@work/domain/value-objects/starting-point.vo';
import { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

const listed = (
  checkouts: readonly ReportedCheckout[] | null,
): readonly ReportedCheckout[] => {
  if (!checkouts) {
    throw new InvalidStartingPointError('checkouts must be a list');
  }

  if (checkouts.length > MOST_STARTED_CHECKOUTS) {
    throw new InvalidStartingPointError(
      `can name at most ${MOST_STARTED_CHECKOUTS} checkouts`,
    );
  }

  return checkouts;
};

export class RecordStartingPointHandler
  implements CommandHandlerPort<RecordStartingPointCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly archives: WorkspaceArchiveRepository,
    private readonly presence: RunnerPresencePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RecordStartingPointCommand): Promise<void> {
    try {
      const runner = RunnerId.of(command.runnerId);
      const now = this.clock.now();

      if (!(await this.presence.seen(runner, now))) {
        throw new UnknownRunnerError(command.runnerId);
      }

      const checkouts = listed(command.checkouts);

      if (!Number.isInteger(command.attempt) || command.attempt < 1) {
        throw new InvalidStartingPointError(
          'must name the attempt the run started on',
        );
      }

      const run = await this.runs.findById(RunId.of(command.runId));

      if (!run) {
        throw new UnknownRunError(`Run ${command.runId} not found.`);
      }

      const attempt = RunAttempt.of(run.id, command.attempt);

      run.assertStillOn(attempt, runner);

      const restored =
        command.archiveId === null
          ? null
          : await this.restored(run, WorkspaceArchiveId.of(command.archiveId));

      await this.runs.save(
        run.startsFrom(
          attempt,
          runner,
          { restored, checkouts: checkouts.map(StartedCheckout.of) },
          now,
        ),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async restored(
    run: Run,
    id: WorkspaceArchiveId,
  ): Promise<RestoredArchive> {
    const archive = await this.archives.find(id);

    if (!archive) {
      throw new InvalidStartingPointError(
        `names archive ${id.value}, which is not kept`,
      );
    }

    return archive.restoredInto(run.workspaceId, run.restoresFrom);
  }
}
