import type { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';

export const WORKSPACE_HOSTS = Symbol('WORKSPACE_HOSTS');

export interface WorkspaceHostsPort {
  fresh(workspaceId: string): Promise<HostAllowList>;
}
