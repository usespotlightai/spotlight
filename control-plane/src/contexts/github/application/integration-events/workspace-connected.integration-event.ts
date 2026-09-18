export const WORKSPACE_CONNECTED = 'github.workspace-connected.v1';

export type WorkspaceConnectedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_CONNECTED;
  readonly workspaceId: string;
};
