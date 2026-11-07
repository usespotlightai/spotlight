import type { RunnerEgressPort } from '@runners/application/ports/runner-egress.port';
import type { EgressAuthorizationDto } from '@runs/application/dto/egress-authorization.dto';
import type { SandboxHostsPort } from '@runs/application/ports/sandbox-hosts.port';
import type { AuthorizeRunnerQuery } from '@runs/application/queries/egress.queries';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class AuthorizeRunnerHandler
  implements QueryHandlerPort<AuthorizeRunnerQuery, EgressAuthorizationDto>
{
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly hosts: SandboxHostsPort,
    private readonly clock: ClockPort,
    private readonly controlPlaneHost: string,
    private readonly controlPlanePort: number,
  ) {}

  async execute(query: AuthorizeRunnerQuery): Promise<EgressAuthorizationDto> {
    try {
      const shared = await this.egress.sharedWith(query.token);
      const authorized = shared
        ? await this.egress.authorizeRunner(
            shared,
            query.proxyCredential,
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
