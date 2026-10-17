import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import type { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export const IDENTITY_RESOURCES = Symbol('IDENTITY_RESOURCES');

export interface WorkspaceRecord {
  readonly id: WorkspaceId;
  readonly version: number;
  readonly name: string;
  readonly slug: string;
}

export interface TeamRecord {
  readonly id: TeamId;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly key: string;
  readonly name: string;
}

export interface WorkspaceTokenRecord {
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

export interface WorkspaceTokenTrustRecord {
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
  readonly createdBy: string;
}

export interface IdentityResourcesPort {
  workspaceWithId(id: WorkspaceId): Promise<WorkspaceRecord | null>;

  workspaceWithSlug(slug: string): Promise<WorkspaceRecord | null>;

  workspacesJoinedBy(userId: UserId): Promise<readonly WorkspaceRecord[]>;

  teamWithId(id: TeamId): Promise<TeamRecord | null>;

  teamAt(workspaceId: WorkspaceId, key: string): Promise<TeamRecord | null>;

  teamsIn(workspaceId: WorkspaceId): Promise<readonly TeamRecord[]>;

  teamKeysIn(workspaceId: WorkspaceId): Promise<readonly string[]>;

  tokenNamesIn(workspaceId: WorkspaceId): Promise<readonly string[]>;

  issuingTrustKeysIn(workspaceId: WorkspaceId): Promise<readonly string[]>;

  tokensIn(workspaceId: WorkspaceId): Promise<readonly WorkspaceTokenRecord[]>;

  tokenWithId(id: WorkspaceTokenId): Promise<WorkspaceTokenRecord | null>;

  tokenAt(
    workspaceId: WorkspaceId,
    name: string,
  ): Promise<WorkspaceTokenRecord | null>;

  tokenTrustWithId(
    id: WorkspaceTokenTrustId,
  ): Promise<WorkspaceTokenTrustRecord | null>;

  tokenTrustAt(
    workspaceId: WorkspaceId,
    key: string,
  ): Promise<WorkspaceTokenTrustRecord | null>;

  tokenTrustsIn(
    workspaceId: WorkspaceId,
  ): Promise<readonly WorkspaceTokenTrustRecord[]>;

  tokenTrustKeysIn(workspaceId: WorkspaceId): Promise<readonly string[]>;
}
