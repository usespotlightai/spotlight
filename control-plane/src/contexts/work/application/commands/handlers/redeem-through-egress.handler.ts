import type { RunnerEgressPort } from '@runners/application/ports/runner-egress.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { RedeemThroughEgressCommand } from '@work/application/commands/egress.commands';
import type { EgressRedemptionDto } from '@work/application/dto/egress-redemption.dto';
import type { EgressRedemptions } from '@work/application/services/egress-redemptions.service';

export class RedeemThroughEgressHandler
  implements CommandHandlerPort<RedeemThroughEgressCommand, EgressRedemptionDto>
{
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly redemptions: EgressRedemptions,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: RedeemThroughEgressCommand,
  ): Promise<EgressRedemptionDto> {
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

      const redeemed = await this.redemptions.redeemedFor(
        { ...admitted, sharedEgress: admitted.egressId },
        command.recipient,
      );

      return admitted.work?.kind !== 'check' && redeemed.runId === null
        ? { outcome: 'waiting' }
        : redeemed;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
