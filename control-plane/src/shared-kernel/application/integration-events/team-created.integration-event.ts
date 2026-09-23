export const TEAM_CREATED = 'identity.team-created.v1';

export type TeamCreatedIntegrationEvent = {
  readonly kind: typeof TEAM_CREATED;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly ownerId: string;
  readonly origin: 'sign-up' | 'configuration';
};
