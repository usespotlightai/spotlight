import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';

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

export interface KeptWorkspaceToken {
  readonly id: WorkspaceTokenId;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly description: string;
  readonly scopes: readonly string[];
  readonly issuedBy: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date | null;
}

export interface IdentityResourcesPort {
  workspaceWithId(id: WorkspaceId): Promise<KeptWorkspace | null>;

  workspaceWithSlug(slug: string): Promise<KeptWorkspace | null>;

  teamWithId(id: TeamId): Promise<KeptTeam | null>;

  teamAt(workspaceId: WorkspaceId, key: string): Promise<KeptTeam | null>;

  teamKeysIn(workspaceId: WorkspaceId): Promise<readonly string[]>;

  tokenNamesIn(workspaceId: WorkspaceId): Promise<readonly string[]>;

  tokenWithId(id: WorkspaceTokenId): Promise<KeptWorkspaceToken | null>;

  tokenAt(
    workspaceId: WorkspaceId,
    name: string,
  ): Promise<KeptWorkspaceToken | null>;
}
