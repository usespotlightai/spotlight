import { Injectable } from '@nestjs/common';
import { EventReactions } from '@platform/events/event-reactions';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { PROVISION_TEAM } from '@work/application/events/handlers/provision-team.handler';
import type {
  Provisioning,
  TeamProvisioningPort,
} from '@work/application/ports/team-provisioning.port';

@Injectable()
export class OutboxTeamProvisioning implements TeamProvisioningPort {
  constructor(private readonly reactions: EventReactions) {}

  async of(teamId: TeamId): Promise<Provisioning> {
    const { owed, deadLettered } = await this.reactions.owedBy(PROVISION_TEAM, {
      teamId: teamId.value,
      origin: 'sign-up',
    });

    if (deadLettered > 0) {
      return 'failed';
    }

    return owed > 0 ? 'pending' : 'done';
  }
}
