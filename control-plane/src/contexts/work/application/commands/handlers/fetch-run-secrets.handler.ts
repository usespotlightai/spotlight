import type { RunnerEgressPort } from '@runners/application/ports/runner-egress.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { FetchRunSecretsCommand } from '@work/application/commands/egress.commands';
import type { EgressSecretsDto } from '@work/application/dto/egress-secrets.dto';
import type { EgressSecretFetches } from '@work/application/services/egress-secret-fetches.service';

export class FetchRunSecretsHandler
  implements CommandHandlerPort<FetchRunSecretsCommand, EgressSecretsDto>
{
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly fetches: EgressSecretFetches,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: FetchRunSecretsCommand): Promise<EgressSecretsDto> {
    try {
      const admitted = await this.egress.admit(command.token, this.clock.now());

      if (!admitted) {
        return { outcome: 'unauthorized' };
      }

      return await this.fetches.fetchFor(
        { ...admitted, sharedEgress: null },
        command.recipient,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
