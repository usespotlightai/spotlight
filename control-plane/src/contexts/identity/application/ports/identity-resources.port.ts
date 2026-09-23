import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const IDENTITY_RESOURCES = Symbol('IDENTITY_RESOURCES');

export interface KeptWorkspace {
  readonly id: WorkspaceId;
  readonly version: number;
  readonly name: string;
  readonly slug: string;
}

export interface KeptTeam {
  readonly id: TeamId;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly name: string;
}

export interface IdentityResourcesPort {
  workspaceWithId(id: WorkspaceId): Promise<KeptWorkspace | null>;

  workspaceWithSlug(slug: string): Promise<KeptWorkspace | null>;

  teamWithId(id: TeamId): Promise<KeptTeam | null>;

  teamAt(workspaceId: WorkspaceId, key: string): Promise<KeptTeam | null>;

  teamKeysIn(workspaceId: WorkspaceId): Promise<readonly string[]>;
}
