export const TEAM_DISBANDED = 'identity.team-disbanded.v1';

export type TeamDisbandedIntegrationEvent = {
  readonly kind: typeof TEAM_DISBANDED;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly key: string;
};
