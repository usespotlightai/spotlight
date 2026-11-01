export const WORKSPACE_OUTBOUND_SCOPE = Symbol('WORKSPACE_OUTBOUND_SCOPE');

export interface WorkspaceOutboundScopePort {
  within<T>(workspaceId: string, work: () => Promise<T>): Promise<T>;

  withinFresh<T>(workspaceId: string, work: () => Promise<T>): Promise<T>;
}
