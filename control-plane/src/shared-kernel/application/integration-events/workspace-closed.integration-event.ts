export const WORKSPACE_CLOSED = 'identity.workspace-closed.v1';

export type WorkspaceClosedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_CLOSED;
  readonly workspaceId: string;
  readonly slug: string;
};
