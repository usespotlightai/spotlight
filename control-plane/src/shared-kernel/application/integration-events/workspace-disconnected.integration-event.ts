export const WORKSPACE_DISCONNECTED = 'github.workspace-disconnected.v1';

export type WorkspaceDisconnectedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_DISCONNECTED;
  readonly workspaceId: string;
};
