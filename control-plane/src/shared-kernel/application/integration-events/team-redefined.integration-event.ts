export const TEAM_REDEFINED = 'identity.team-redefined.v1';

export type TeamRedefinedIntegrationEvent = {
  readonly kind: typeof TEAM_REDEFINED;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly key: string;
};
