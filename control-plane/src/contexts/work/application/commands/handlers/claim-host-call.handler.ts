import type { RunnerAdmissionsPort } from '@runners/application/ports/runner-admissions.port';
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
    private readonly admissions: RunnerAdmissionsPort,
    private readonly runners: RunnersPort,
    private readonly calls: NetworkCallRepository,
    private readonly clock: ClockPort,
    private readonly polls: LongPoll,
  ) {}

  async execute(command: ClaimHostCallCommand): Promise<HostCallClaimDto> {
    try {
      const admitted = await this.admissions.admit(command.credential);

      if (!admitted) {
        return { outcome: 'refused' };
      }

      const host = CallingHost.of(command.host);

      if (!(await this.runners.reports(admitted.way, host.value))) {
        return { outcome: 'stranger' };
      }

      const claimed = await this.polls.polled(() =>
        this.calls.claimNext(admitted.workspaceId, host, this.clock.now()),
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
