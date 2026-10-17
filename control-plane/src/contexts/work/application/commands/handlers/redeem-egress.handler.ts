import type { RunnerEgressPort } from '@runners/application/ports/runner-egress.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { RedeemEgressCommand } from '@work/application/commands/egress.commands';
import type { EgressRedemptionDto } from '@work/application/dto/egress-redemption.dto';
import type { EgressRedemptions } from '@work/application/services/egress-redemptions.service';

export class RedeemEgressHandler
  implements CommandHandlerPort<RedeemEgressCommand, EgressRedemptionDto>
{
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly redemptions: EgressRedemptions,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RedeemEgressCommand): Promise<EgressRedemptionDto> {
    try {
      const admitted = await this.egress.admit(command.token, this.clock.now());

      if (!admitted) {
        return { outcome: 'refused' };
      }

      return await this.redemptions.redeemedFor(
        { ...admitted, sharedEgress: null },
        command.recipient,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
