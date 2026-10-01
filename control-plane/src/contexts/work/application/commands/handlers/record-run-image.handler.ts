import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { RecordRunImageCommand } from '@work/application/commands/runner.commands';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import { UnknownRunnerError } from '@work/domain/exceptions/unknown-runner.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class RecordRunImageHandler
  implements CommandHandlerPort<RecordRunImageCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly presence: RunnerPresencePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RecordRunImageCommand): Promise<void> {
    try {
      const runner = RunnerId.of(command.runnerId);

      if (!(await this.presence.seen(runner, this.clock.now()))) {
        throw new UnknownRunnerError(command.runnerId);
      }

      const run = await this.runs.findById(RunId.of(command.runId));

      if (!run) {
        throw new UnknownRunError(`there is no run ${command.runId}`);
      }

      await this.runs.save(
        run.startedIn(runner, RunnerImage.of(command.image), this.clock.now()),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
