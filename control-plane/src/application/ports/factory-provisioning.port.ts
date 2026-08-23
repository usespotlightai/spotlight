import type { TeamCreated } from '@domain/events/team-created.event';

export const FACTORY_PROVISIONING = Symbol('FACTORY_PROVISIONING');

export interface FactoryProvisioningPort {
  onTeamCreated(event: TeamCreated): Promise<void>;
}
