import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_PROVISIONING = Symbol('WORKSPACE_PROVISIONING');

export const PROVISIONINGS = ['pending', 'done', 'failed'] as const;

export type Provisioning = (typeof PROVISIONINGS)[number];

export interface WorkspaceProvisioningPort {
  of(workspaceId: WorkspaceId): Promise<Provisioning>;
}
