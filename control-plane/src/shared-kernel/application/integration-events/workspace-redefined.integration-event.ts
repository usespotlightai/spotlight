export const WORKSPACE_REDEFINED = 'identity.workspace-redefined.v1';

export type WorkspaceRedefinedIntegrationEvent = {
  readonly kind: typeof WORKSPACE_REDEFINED;
  readonly workspaceId: string;
  readonly name: string;
};
