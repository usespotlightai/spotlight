export const WORKSPACE_DELETED = 'identity.workspace-deleted.v1';

export type WorkspaceDeletedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_DELETED;
  readonly workspaceId: string;
  readonly slug: string;
};
