import type { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_OUTBOUND_HOSTS = Symbol('WORKSPACE_OUTBOUND_HOSTS');

export interface WorkspaceOutboundHostsPort {
  of(workspaceId: WorkspaceId): Promise<HostAllowList>;

  fresh(workspaceId: WorkspaceId): Promise<HostAllowList>;

  forget(workspaceId: WorkspaceId): void;
}
