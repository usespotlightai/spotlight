import type { RunnerClaimantsPort } from '@runners/application/ports/runner-claimants.port';
import type { RevealSandboxEnvCommand } from '@runs/application/commands/runner.commands';
import type { SandboxEnvDto } from '@runs/application/dto/sandbox-env.dto';
import { UnknownRunError } from '@runs/domain/exceptions/unknown-run.error';
import { UnknownRunnerError } from '@runs/domain/exceptions/unknown-runner.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import type { SandboxEnvRevealsPort } from '@secrets/application/ports/sandbox-env-reveals.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RevealSandboxEnvHandler implements CommandHandlerPort<
  RevealSandboxEnvCommand,
  SandboxEnvDto
> {
  constructor(
    private readonly runs: RunRepository,
    private readonly claimants: RunnerClaimantsPort,
    private readonly reveals: SandboxEnvRevealsPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RevealSandboxEnvCommand): Promise<SandboxEnvDto> {
    try {
      const runner = RunnerId.of(command.runnerId);

      if (!(await this.claimants.claimantOf(runner, this.clock.now()))) {
        throw new UnknownRunnerError(command.runnerId);
      }

      const runId = RunId.of(command.runId);
      const run = await this.runs.findById(runId);

      if (!run) {
        throw new UnknownRunError(`Run ${command.runId} not found.`);
      }

      const attempt = RunAttempt.reported(run.id, command.attempt);
      const variables = run.sandboxEnvOn(attempt, runner);

      if (variables.length === 0) {
        return { variables: [], denied: [] };
      }

      const revealed = await this.reveals.revealFor({
        workspaceId: run.workspaceId.value,
        runId: run.id.value,
        variables,
      });

      const still = await this.runs.findById(runId);

      if (!still) {
        throw new UnknownRunError(`Run ${command.runId} not found.`);
      }

      still.assertStillOn(attempt, runner);

      return revealed;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
