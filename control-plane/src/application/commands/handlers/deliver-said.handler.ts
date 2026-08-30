import type { DeliverSaidCommand } from '@application/commands/deliver-said.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { NotePosition } from '@domain/value-objects/note-position.vo';
import { RunId } from '@domain/value-objects/run-id.vo';

export class DeliverSaidHandler
  implements CommandHandlerPort<DeliverSaidCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: DeliverSaidCommand): Promise<void> {
    try {
      const run = await this.runs.findById(RunId.of(command.runId));
      const task = run?.taskId ? await this.tasks.find(run.taskId) : null;

      if (!task) {
        return;
      }

      await this.tasks.save(
        task.deliveredUpTo(NotePosition.of(command.upTo), this.clock.now()),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
