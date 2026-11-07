import type { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';

export const DELIVERY_REACTIONS = Symbol('DELIVERY_REACTIONS');

export interface DeliveryReactionsPort {
  react(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happenings: readonly Happened[],
    receivedAs: string,
  ): Promise<DeliveryFailure | null>;
}
