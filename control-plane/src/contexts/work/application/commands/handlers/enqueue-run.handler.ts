import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { EnqueueRunCommand } from '@work/application/commands/runner.commands';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import type { EnqueuedRunDto } from '@work/application/dto/run.dto';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { UnknownHarnessError } from '@work/domain/exceptions/unknown-harness.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class EnqueueRunHandler
  implements CommandHandlerPort<EnqueueRunCommand, EnqueuedRunDto | null>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
    private readonly launch: HarnessLaunchPort,
    private readonly access: WorkspaceAccessPort,
  ) {}

  async execute(command: EnqueueRunCommand): Promise<EnqueuedRunDto | null> {
    try {
      const membership = await this.access.inWorkspace(
        command.slug,
        UserId.of(command.viewerId),
      );

      if (!membership) {
        return null;
      }

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
        workspaceId: membership.workspaceId,
        harness,
        spec: RunSpecContract.ordered(command.spec, started.started()),
      });

      await this.runs.add(queued);

      return {
        id: queued.id.value,
        harness: queued.harness.value,
        state: queued.state,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
