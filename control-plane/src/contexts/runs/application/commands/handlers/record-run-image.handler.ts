import type { RunnerClaimantsPort } from '@runners/application/ports/runner-claimants.port';
import type { RecordRunImageCommand } from '@runs/application/commands/runner.commands';
import { UnknownRunError } from '@runs/domain/exceptions/unknown-run.error';
import { UnknownRunnerError } from '@runs/domain/exceptions/unknown-runner.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';

export class RecordRunImageHandler implements CommandHandlerPort<
  RecordRunImageCommand,
  void
> {
  constructor(
    private readonly runs: RunRepository,
    private readonly claimants: RunnerClaimantsPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RecordRunImageCommand): Promise<void> {
    try {
      const runner = RunnerId.of(command.runnerId);

      if (!(await this.claimants.claimantOf(runner, this.clock.now()))) {
        throw new UnknownRunnerError(command.runnerId);
      }

      const run = await this.runs.findById(RunId.of(command.runId));

      if (!run) {
        throw new UnknownRunError(`Run ${command.runId} not found.`);
      }

      await this.runs.save(
        run.startedIn(runner, RunnerImage.of(command.image), this.clock.now()),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
