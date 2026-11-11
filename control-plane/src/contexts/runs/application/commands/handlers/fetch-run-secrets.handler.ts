import type { RunnerEgressPort } from '@runners/application/ports/runner-egress.port';
import type { FetchRunSecretsCommand } from '@runs/application/commands/egress.commands';
import type { EgressSecretsDto } from '@runs/application/dto/egress-secrets.dto';
import type { EgressSecretFetches } from '@runs/application/services/egress-secret-fetches.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

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
      const authenticated = await this.egress.authenticate(
        command.token,
        this.clock.now(),
      );

      if (!authenticated) {
        return { outcome: 'unauthorized' };
      }

      return await this.fetches.fetchFor(
        { ...authenticated, sharedEgress: null },
        command.recipient,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
