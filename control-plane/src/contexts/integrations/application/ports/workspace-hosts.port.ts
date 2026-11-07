import type { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_HOSTS = Symbol('WORKSPACE_HOSTS');

export interface WorkspaceHostsPort {
  fresh(workspaceId: WorkspaceId): Promise<HostAllowList>;
}
