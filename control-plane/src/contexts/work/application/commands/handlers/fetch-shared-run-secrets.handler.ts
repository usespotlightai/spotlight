import type { RunnerEgressPort } from '@runners/application/ports/runner-egress.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { FetchSharedRunSecretsCommand } from '@work/application/commands/egress.commands';
import type { EgressSecretsDto } from '@work/application/dto/egress-secrets.dto';
import type { EgressSecretFetches } from '@work/application/services/egress-secret-fetches.service';

export class FetchSharedRunSecretsHandler
  implements CommandHandlerPort<FetchSharedRunSecretsCommand, EgressSecretsDto>
{
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly fetches: EgressSecretFetches,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: FetchSharedRunSecretsCommand,
  ): Promise<EgressSecretsDto> {
    try {
      const shared = await this.egress.sharedWith(command.token);
      const admitted = shared
        ? await this.egress.admitThrough(
            shared,
            command.proxyCredential,
            this.clock.now(),
          )
        : null;

      if (!admitted) {
        return { outcome: 'refused' };
      }

      const fetched = await this.fetches.fetchFor(
        { ...admitted, sharedEgress: admitted.egressId },
        command.recipient,
      );

      return admitted.work?.kind !== 'check' && fetched.runId === null
        ? { outcome: 'waiting' }
        : fetched;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
