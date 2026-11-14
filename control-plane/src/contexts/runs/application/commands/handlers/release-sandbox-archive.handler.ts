import type { ReleaseSandboxArchiveCommand } from '@runs/application/commands/working-copy-archive.commands';
import type { SandboxArchives } from '@runs/application/services/sandbox-archives.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class ReleaseSandboxArchiveHandler implements CommandHandlerPort<
  ReleaseSandboxArchiveCommand,
  boolean
> {
  constructor(
    private readonly sandboxes: SandboxArchives,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ReleaseSandboxArchiveCommand): Promise<boolean> {
    try {
      const sandbox = await this.sandboxes.authenticated(
        command.sandboxId,
        command.token,
      );

      if (!sandbox) {
        return false;
      }

      await this.sandboxes.releaseArchive(
        sandbox,
        RunId.of(command.runId),
        command.attempt,
        this.clock.now(),
      );

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
