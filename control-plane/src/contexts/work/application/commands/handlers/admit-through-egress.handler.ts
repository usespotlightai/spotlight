import type { RunnerEgressPort } from '@runners/application/ports/runner-egress.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { AdmitThroughEgressCommand } from '@work/application/commands/egress.commands';
import type { EgressAdmissionDto } from '@work/application/dto/egress-admission.dto';
import type { SandboxReachPort } from '@work/application/ports/sandbox-reach.port';

export class AdmitThroughEgressHandler
  implements CommandHandlerPort<AdmitThroughEgressCommand, EgressAdmissionDto>
{
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly reach: SandboxReachPort,
    private readonly clock: ClockPort,
    private readonly controlPlaneHost: string,
    private readonly controlPlanePort: number,
  ) {}

  async execute(
    command: AdmitThroughEgressCommand,
  ): Promise<EgressAdmissionDto> {
    try {
      const shared = await this.egress.sharedWith(command.token);
      const admitted = shared
        ? await this.egress.admitThrough(
            shared,
            command.proxyCredential,
            this.clock.now(),
          )
        : null;

      return admitted
        ? {
            outcome: 'admitted',
            runnerId: admitted.runnerId,
            workspaceId: admitted.workspaceId,
            controlPlaneHost: this.controlPlaneHost,
            controlPlanePort: this.controlPlanePort,
            reaches: this.reach.hosts(),
          }
        : { outcome: 'refused' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
