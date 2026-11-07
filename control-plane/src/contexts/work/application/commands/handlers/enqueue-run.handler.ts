import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { EnqueueRunCommand } from '@work/application/commands/runner.commands';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import type { EnqueuedRunDto } from '@work/application/dto/run.dto';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { RunsPort } from '@work/application/ports/runs.port';
import { UnknownHarnessError } from '@work/domain/exceptions/unknown-harness.error';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';

export class EnqueueRunHandler
  implements CommandHandlerPort<EnqueueRunCommand, EnqueuedRunDto | null>
{
  constructor(
    private readonly runs: RunsPort,
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

      const id = this.ids.generate();

      await this.runs.enqueue({
        runId: id,
        workspaceId: membership.workspaceId.value,
        harness: harness.value,
        priority: RunPriority.normal.value,
        placement: { labelGroups: [], image: null },
        spec: RunSpecContract.toWire(
          RunSpecContract.ordered(command.spec, started.started()),
        ),
        subject: null,
        team: null,
        refusal: null,
      });

      return { id, harness: harness.value, state: 'queued' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
