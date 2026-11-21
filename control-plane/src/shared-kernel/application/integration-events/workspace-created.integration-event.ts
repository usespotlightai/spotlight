export const WORKSPACE_CREATED = 'identity.workspace-created.v1';

export type WorkspaceCreatedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_CREATED;
  readonly workspaceId: string;
};
