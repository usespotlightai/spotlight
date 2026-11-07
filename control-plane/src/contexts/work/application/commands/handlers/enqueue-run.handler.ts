import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { EnqueueRunCommand } from '@work/application/commands/runner.commands';
import {
  type RunPolicyContract,
  type RunWorkspaceContract,
  workspaceKeyOf,
} from '@work/application/contracts/run-order.contract';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import type { EnqueuedRunDto } from '@work/application/dto/run.dto';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { RunsPort } from '@work/application/ports/runs.port';
import { RunOrderRefusedError } from '@work/domain/exceptions/run-order-refused.error';
import { RunWorkspaceKeyConflictError } from '@work/domain/exceptions/run-workspace-key-conflict.error';
import { UnknownHarnessError } from '@work/domain/exceptions/unknown-harness.error';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';

const OWNER = 'workspace';

const SPEC_POLICY: RunPolicyContract = {
  holdsTurn: false,
  gated: false,
  actsBeyondItself: true,
  asks: 'requester',
  listed: true,
  exclusive: false,
};

const workspaceOf = (requested: string): RunWorkspaceContract => {
  const at = requested.indexOf('/');

  if (at >= 0 && requested.slice(0, at) !== OWNER) {
    throw new RunWorkspaceKeyConflictError(requested);
  }

  return {
    key: workspaceKeyOf(OWNER, at >= 0 ? requested.slice(at + 1) : requested),
    rejoinable: false,
    restores: 'when-continuing',
  };
};

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
      const ordered = RunSpecContract.ordered(command.spec, started.started());
      const enqueued = await this.runs.enqueue({
        runId: id,
        workspaceId: membership.workspaceId.value,
        harness: harness.value,
        priority: RunPriority.normal.value,
        placement: { labelGroups: [], image: null },
        spec: RunSpecContract.toWire(ordered.spec),
        requester: {
          owner: OWNER,
          kind: 'spec',
          id,
          token: null,
          team: null,
        },
        policy: SPEC_POLICY,
        workspace: ordered.key ? workspaceOf(ordered.key) : null,
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
