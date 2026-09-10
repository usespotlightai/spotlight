import type { EnqueueRunCommand } from '@application/commands/runner.commands';
import { RunSpecContract } from '@application/contracts/run-spec.contract';
import type { EnqueuedRunDto } from '@application/dto/run.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { HarnessLaunchPort } from '@application/ports/harness-launch.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import { Run } from '@domain/aggregates/run.aggregate';
import { UnknownHarnessError } from '@domain/exceptions/unknown-harness.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class EnqueueRunHandler
  implements CommandHandlerPort<EnqueueRunCommand, EnqueuedRunDto>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
    private readonly launch: HarnessLaunchPort,
  ) {}

  async execute(command: EnqueueRunCommand): Promise<EnqueuedRunDto> {
    try {
      const harness = HarnessId.of(command.harness);
      const started = this.launch.commandFor(harness, {
        model: null,
        effort: null,
      });
      if (!started) {
        throw new UnknownHarnessError(command.harness);
      }

      const queued = Run.enqueue({
        id: RunId.of(this.ids.generate()),
        workspaceId: WorkspaceId.of(command.workspaceId),
        harness,
        spec: RunSpec.of(
          RunSpecContract.ordered(command.spec, started.started()),
        ),
        targetRunner: command.targetRunnerId
          ? RunnerId.of(command.targetRunnerId)
          : null,
      });

      await this.runs.add(queued);

      return {
        id: queued.id.value,
        harness: queued.harness.value,
        state: queued.state,
        targetRunnerId: queued.targetRunner?.value ?? null,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
