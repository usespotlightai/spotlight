import { Injectable } from '@nestjs/common';
import { DeliveryBacklog } from '@platform/events/delivery-backlog';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { SEED_TEAM } from '@work/application/events/handlers/seed-team.handler';
import type {
  Provisioning,
  TeamProvisioningPort,
} from '@work/application/ports/team-provisioning.port';

@Injectable()
export class OutboxTeamProvisioning implements TeamProvisioningPort {
  constructor(private readonly backlog: DeliveryBacklog) {}

  async of(teamId: TeamId): Promise<Provisioning> {
    const { pending, deadLettered } = await this.backlog.pendingDeliveriesFor(
      SEED_TEAM,
      {
        teamId: teamId.value,
        origin: 'sign-up',
      },
    );

    if (deadLettered > 0) {
      return 'failed';
    }

    return pending > 0 ? 'pending' : 'done';
  }
}
