import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { ReadInboxAsideCommand } from '@work/application/commands/read-inbox-aside.command';
import type { AsideLoader } from '@work/application/services/aside-loader.service';
import { TaskAsideVersionConflictError } from '@work/domain/exceptions/task-aside-version-conflict.error';
import type { TaskAsideRepository } from '@work/domain/repositories/task-aside.repository';

export class ReadInboxAsideHandler
  implements CommandHandlerPort<ReadInboxAsideCommand, void>
{
  constructor(
    private readonly loader: AsideLoader,
    private readonly asides: TaskAsideRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ReadInboxAsideCommand): Promise<void> {
    try {
      await this.readOnce(command).catch((error: unknown) => {
        if (error instanceof TaskAsideVersionConflictError) {
          return this.readOnce(command);
        }
        throw error;
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async readOnce(command: ReadInboxAsideCommand): Promise<void> {
    const aside = await this.loader.putTo(command.asideId, command.readBy);
    const viewer = UserId.of(command.readBy);

    if (aside.unreadBy(viewer)) {
      await this.asides.save(aside.readBy(viewer, this.clock.now()));
    }
  }
}
