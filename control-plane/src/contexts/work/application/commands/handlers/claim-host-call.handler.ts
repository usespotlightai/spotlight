import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type { RunnersPort } from '@runners/application/ports/runners.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { ClaimHostCallCommand } from '@work/application/commands/host-call.commands';
import type { HostCallClaimDto } from '@work/application/dto/host-call.dto';
import type { LongPoll } from '@work/application/services/long-poll';
import type { NetworkCallRepository } from '@work/domain/repositories/network-call.repository';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';

export class ClaimHostCallHandler
  implements CommandHandlerPort<ClaimHostCallCommand, HostCallClaimDto>
{
  constructor(
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly runners: RunnersPort,
    private readonly calls: NetworkCallRepository,
    private readonly clock: ClockPort,
    private readonly polls: LongPoll,
  ) {}

  async execute(command: ClaimHostCallCommand): Promise<HostCallClaimDto> {
    try {
      const authenticated = await this.authenticator.authenticate(
        command.credential,
      );

      if (!authenticated) {
        return { outcome: 'unauthorized' };
      }

      const host = CallingHost.of(command.host);

      if (!(await this.runners.reports(authenticated.source, host.value))) {
        return { outcome: 'host-unreported' };
      }

      const claimed = await this.polls.polled(() =>
        this.calls.claimNext(authenticated.workspaceId, host, this.clock.now()),
      );

      if (!claimed) {
        return { outcome: 'nothing' };
      }

      const { request } = claimed;

      return {
        outcome: 'claimed',
        call: {
          id: claimed.id.value,
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: Buffer.from(request.body).toString('base64'),
          timeoutMs: request.timeoutMs,
        },
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
