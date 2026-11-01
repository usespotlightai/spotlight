import type { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';

export const WORKSPACE_OUTBOUND_HOSTS = Symbol('WORKSPACE_OUTBOUND_HOSTS');

export interface WorkspaceOutboundHostsPort {
  of(workspaceId: string): Promise<HostAllowList>;

  fresh(workspaceId: string): Promise<HostAllowList>;

  forget(workspaceId: string): void;
}
