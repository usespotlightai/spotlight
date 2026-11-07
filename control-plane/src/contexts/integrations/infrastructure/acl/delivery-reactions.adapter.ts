import type { DeliveryReactionsPort } from '@integrations/application/ports/delivery-reactions.port';
import type { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import { deliveryFailureOf } from '@integrations/infrastructure/webhooks/delivery-failures';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';
import type { HappeningReactionsPort } from '@work/application/ports/happening-reactions.port';

export class WorkDeliveryReactions implements DeliveryReactionsPort {
  constructor(private readonly reactions: HappeningReactionsPort) {}

  async react(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happenings: readonly Happened[],
    receivedAs: string,
  ): Promise<DeliveryFailure | null> {
    try {
      await this.reactions.react(workspaceId, teamId, happenings, receivedAs);

      return null;
    } catch (error) {
      const failure = deliveryFailureOf(error);

      if (!failure) {
        throw error;
      }

      return failure;
    }
  }
}
