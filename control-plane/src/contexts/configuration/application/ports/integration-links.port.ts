import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const INTEGRATION_LINKS = Symbol('INTEGRATION_LINKS');

export interface IntegrationLink {
  readonly source: string;
  readonly handle: string | null;
}

export interface IntegrationLinksPort {
  heldBy(teamId: TeamId): Promise<readonly IntegrationLink[]>;
}
