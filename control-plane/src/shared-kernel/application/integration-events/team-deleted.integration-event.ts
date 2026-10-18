export const TEAM_DELETED = 'identity.team-deleted.v1';

export type TeamDeletedIntegrationEvent = {
  readonly kind: typeof TEAM_DELETED;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly key: string;
};
