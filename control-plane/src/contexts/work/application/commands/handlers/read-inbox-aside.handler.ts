import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ReadInboxAsideCommand } from '@work/application/commands/read-inbox-aside.command';
import type { AsideAtHand } from '@work/application/services/aside-at-hand.service';
import { TaskAsideMovedOnError } from '@work/domain/exceptions/task-aside-moved-on.error';
import type { TaskAsideRepository } from '@work/domain/repositories/task-aside.repository';

export class ReadInboxAsideHandler
  implements CommandHandlerPort<ReadInboxAsideCommand, void>
{
  constructor(
    private readonly asides: AsideAtHand,
    private readonly held: TaskAsideRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ReadInboxAsideCommand): Promise<void> {
    try {
      await this.readOnce(command).catch((error: unknown) => {
        if (error instanceof TaskAsideMovedOnError) {
          return this.readOnce(command);
        }
        throw error;
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async readOnce(command: ReadInboxAsideCommand): Promise<void> {
    const aside = await this.asides.putTo(command.asideId, command.readBy);
    const viewer = UserId.of(command.readBy);

    if (aside.unreadBy(viewer)) {
      await this.held.save(aside.readBy(viewer, this.clock.now()));
    }
  }
}
