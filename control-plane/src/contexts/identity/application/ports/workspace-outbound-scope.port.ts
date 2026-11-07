import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_OUTBOUND_SCOPE = Symbol('WORKSPACE_OUTBOUND_SCOPE');

export const UNLISTED_FOR_WORKSPACE =
  "Host is not on the workspace's allowed list.";

export interface WorkspaceOutboundScopePort {
  within<T>(workspaceId: WorkspaceId, work: () => Promise<T>): Promise<T>;

  withinFresh<T>(workspaceId: WorkspaceId, work: () => Promise<T>): Promise<T>;
}
