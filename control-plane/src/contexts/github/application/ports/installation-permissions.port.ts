import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface InstallationPermissionsDto {
  readonly workflows: boolean;
  readonly variables: boolean;
}

export const INSTALLATION_PERMISSIONS = Symbol('INSTALLATION_PERMISSIONS');

export interface InstallationPermissionsPort {
  // What the workspace's installation of the GitHub App may do. Null when the
  // workspace has no installation, or GitHub would not say.
  of(workspaceId: WorkspaceId): Promise<InstallationPermissionsDto | null>;
}
