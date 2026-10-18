import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE_SETUP_STATUS = Symbol('WORKSPACE_SETUP_STATUS');

export const WORKSPACE_SETUP_STATUSES = ['pending', 'done', 'failed'] as const;

export type WorkspaceSetupStatus = (typeof WORKSPACE_SETUP_STATUSES)[number];

export interface WorkspaceSetupStatusPort {
  of(workspaceId: WorkspaceId): Promise<WorkspaceSetupStatus>;
}
