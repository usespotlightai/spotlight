import type { OpenSandboxCommand } from '@runners/application/commands/sandbox.commands';
import type {
  OpenedSandbox,
  SandboxesPort,
} from '@runners/application/ports/sandboxes.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class OpenSandboxHandler
  implements CommandHandlerPort<OpenSandboxCommand, OpenedSandbox>
{
  constructor(
    private readonly sandboxes: SandboxesPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: OpenSandboxCommand): Promise<OpenedSandbox> {
    try {
      return await this.sandboxes.open(
        command.workspaceId,
        command.key,
        this.clock.now(),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
