import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface InstallationPermissionsDto {
  readonly workflows: boolean;
  readonly variables: boolean;
}

export const INSTALLATION_PERMISSIONS = Symbol('INSTALLATION_PERMISSIONS');

export interface InstallationPermissionsPort {
  of(workspaceId: WorkspaceId): Promise<InstallationPermissionsDto | null>;
}
