import type {
  Provisioning,
  WorkspaceProvisioningPort,
} from '@identity/application/ports/workspace-provisioning.port';
import { FIRST_TEAM } from '@identity/application/services/first-team.service';
import { Injectable } from '@nestjs/common';
import { EventReactions } from '@platform/events/event-reactions';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

@Injectable()
export class OutboxWorkspaceProvisioning implements WorkspaceProvisioningPort {
  constructor(private readonly reactions: EventReactions) {}

  async of(workspaceId: WorkspaceId): Promise<Provisioning> {
    const { owed, deadLettered } = await this.reactions.owedBy(FIRST_TEAM, {
      workspaceId: workspaceId.value,
    });

    if (deadLettered > 0) {
      return 'failed';
    }

    return owed > 0 ? 'pending' : 'done';
  }
}
