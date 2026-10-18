import type { RunnerEgressPort } from '@runners/application/ports/runner-egress.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { AuthorizeRunnerCommand } from '@work/application/commands/egress.commands';
import type { EgressAuthorizationDto } from '@work/application/dto/egress-authorization.dto';
import type { SandboxHostsPort } from '@work/application/ports/sandbox-hosts.port';

export class AuthorizeRunnerHandler
  implements CommandHandlerPort<AuthorizeRunnerCommand, EgressAuthorizationDto>
{
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly hosts: SandboxHostsPort,
    private readonly clock: ClockPort,
    private readonly controlPlaneHost: string,
    private readonly controlPlanePort: number,
  ) {}

  async execute(
    command: AuthorizeRunnerCommand,
  ): Promise<EgressAuthorizationDto> {
    try {
      const shared = await this.egress.sharedWith(command.token);
      const authorized = shared
        ? await this.egress.authorizeRunner(
            shared,
            command.proxyCredential,
            this.clock.now(),
          )
        : null;

      return authorized
        ? {
            outcome: 'authorized',
            runnerId: authorized.runnerId,
            workspaceId: authorized.workspaceId,
            controlPlaneHost: this.controlPlaneHost,
            controlPlanePort: this.controlPlanePort,
            extraAllowedHosts: this.hosts.hosts(),
          }
        : { outcome: 'unauthorized' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
