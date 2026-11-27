import type { HoldSandboxArchiveCommand } from '@runs/application/commands/working-copy-archive.commands';
import type { SandboxArchives } from '@runs/application/services/sandbox-archives.service';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class HoldSandboxArchiveHandler implements CommandHandlerPort<
  HoldSandboxArchiveCommand,
  boolean
> {
  constructor(
    private readonly sandboxes: SandboxArchives,
    private readonly runs: RunRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: HoldSandboxArchiveCommand): Promise<boolean> {
    try {
      const sandbox = await this.sandboxes.authenticated(
        command.sandboxId,
        command.token,
      );
      const run = sandbox
        ? await this.runs.findById(RunId.of(command.runId))
        : null;

      if (!sandbox || !run?.workspaceId.equals(sandbox.workspaceId)) {
        return false;
      }

      run.mayActBeyondItself('archive a working copy for a later run');

      const now = this.clock.now();

      return run.attemptInTurn(command.attempt)
        ? await this.sandboxes.holdArchive(
            sandbox,
            run.id,
            command.attempt,
            now,
          )
        : await this.sandboxes.renewArchive(
            sandbox,
            run.id,
            command.attempt,
            now,
          );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
