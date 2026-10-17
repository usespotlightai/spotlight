import type {
  Provisioning,
  WorkspaceProvisioningPort,
} from '@identity/application/ports/workspace-provisioning.port';
import { FIRST_TEAM } from '@identity/application/services/first-team.service';
import { Injectable } from '@nestjs/common';
import { DeliveryBacklog } from '@platform/events/delivery-backlog';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

@Injectable()
export class OutboxWorkspaceProvisioning implements WorkspaceProvisioningPort {
  constructor(private readonly backlog: DeliveryBacklog) {}

  async of(workspaceId: WorkspaceId): Promise<Provisioning> {
    const { pending, deadLettered } = await this.backlog.pendingDeliveriesFor(
      FIRST_TEAM,
      {
        workspaceId: workspaceId.value,
      },
    );

    if (deadLettered > 0) {
      return 'failed';
    }

    return pending > 0 ? 'pending' : 'done';
  }
}
