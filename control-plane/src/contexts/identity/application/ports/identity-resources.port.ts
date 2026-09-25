import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import type { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

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

export interface KeptWorkspaceTokenTrust {
  readonly id: WorkspaceTokenTrustId;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly issuer: string;
  readonly audience: string;
  readonly subject: string;
  readonly claims: Readonly<Record<string, string>>;
  readonly scopes: readonly string[];
  readonly lifetimeMinutes: number;
  readonly definedBy: string;
}

export interface IdentityResourcesPort {
  workspaceWithId(id: WorkspaceId): Promise<KeptWorkspace | null>;

  workspaceWithSlug(slug: string): Promise<KeptWorkspace | null>;

  workspacesJoinedBy(userId: UserId): Promise<readonly KeptWorkspace[]>;

  teamWithId(id: TeamId): Promise<KeptTeam | null>;

  teamAt(workspaceId: WorkspaceId, key: string): Promise<KeptTeam | null>;

  teamsIn(workspaceId: WorkspaceId): Promise<readonly KeptTeam[]>;

  teamKeysIn(workspaceId: WorkspaceId): Promise<readonly string[]>;

  tokenNamesIn(workspaceId: WorkspaceId): Promise<readonly string[]>;

  tokensIn(workspaceId: WorkspaceId): Promise<readonly KeptWorkspaceToken[]>;

  tokenWithId(id: WorkspaceTokenId): Promise<KeptWorkspaceToken | null>;

  tokenAt(
    workspaceId: WorkspaceId,
    name: string,
  ): Promise<KeptWorkspaceToken | null>;

  tokenTrustWithId(
    id: WorkspaceTokenTrustId,
  ): Promise<KeptWorkspaceTokenTrust | null>;

  tokenTrustAt(
    workspaceId: WorkspaceId,
    key: string,
  ): Promise<KeptWorkspaceTokenTrust | null>;

  tokenTrustsIn(
    workspaceId: WorkspaceId,
  ): Promise<readonly KeptWorkspaceTokenTrust[]>;

  tokenTrustKeysIn(workspaceId: WorkspaceId): Promise<readonly string[]>;
}
