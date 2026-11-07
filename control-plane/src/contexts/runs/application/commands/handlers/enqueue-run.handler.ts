import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { EnqueueRunCommand } from '@runs/application/commands/runner.commands';
import type {
  RunPolicyContract,
  RunWorkingCopyContract,
} from '@runs/application/contracts/run-order.contract';
import type { EnqueuedRunDto } from '@runs/application/dto/run.dto';
import { RunSpecMapper } from '@runs/application/mappers/run-spec.mapper';
import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import type { RunsPort } from '@runs/application/ports/runs.port';
import { RunOrderRefusedError } from '@runs/domain/exceptions/run-order-refused.error';
import { UnknownHarnessError } from '@runs/domain/exceptions/unknown-harness.error';
import { RunPriority } from '@runs/domain/value-objects/run-priority.vo';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const OWNER = 'workspace';

const SPEC_POLICY: RunPolicyContract = {
  holdsTurn: false,
  gated: false,
  actsBeyondItself: true,
  asks: 'requester',
  listed: true,
  exclusive: false,
};

const workingCopyOf = (requested: string): RunWorkingCopyContract => ({
  key: WorkingCopyKey.requestedBy(OWNER, requested).value,
  rejoinable: false,
  restores: 'when-continuing',
});

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
      const ordered = RunSpecMapper.ordered(command.spec, started);
      const enqueued = await this.runs.enqueue({
        runId: id,
        workspaceId: membership.workspaceId.value,
        harness: harness.value,
        priority: RunPriority.normal.value,
        placement: { labelGroups: [], image: null },
        spec: ordered.spec.value,
        requester: {
          owner: OWNER,
          kind: 'spec',
          id,
          token: null,
          team: null,
        },
        policy: SPEC_POLICY,
        workingCopy: ordered.key ? workingCopyOf(ordered.key) : null,
        restore: null,
        extensions: {},
        apiGrant: null,
        tags: {},
        refusal: null,
      });

      if (enqueued.outcome === 'refused') {
        throw new RunOrderRefusedError(enqueued.reason);
      }

      return { id, harness: harness.value, state: 'queued' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
