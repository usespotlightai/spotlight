import type { TeamCreated } from '@domain/events/team-created.event';
import type { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';

export const FACTORY_PROVISIONING = Symbol('FACTORY_PROVISIONING');

export interface FactoryProvisioningPort {
  onTeamCreated(event: TeamCreated, at: WorkspaceSlug): Promise<void>;
}
