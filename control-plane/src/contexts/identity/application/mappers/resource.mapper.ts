import type { OidcTrustResourceDto } from '@identity/application/dto/oidc-trust-resource.dto';
import type { TeamResourceDto } from '@identity/application/dto/team-resource.dto';
import type { WorkspaceResourceDto } from '@identity/application/dto/workspace-resource.dto';
import type { WorkspaceTokenResourceDto } from '@identity/application/dto/workspace-token-resource.dto';
import type {
  OidcTrustRecord,
  TeamRecord,
  WorkspaceRecord,
  WorkspaceTokenRecord,
} from '@identity/application/ports/identity-resources.port';

export const ResourceMapper = {
  workspace(workspace: WorkspaceRecord): WorkspaceResourceDto {
    return {
      id: workspace.id.value,
      version: workspace.version,
      address: workspace.slug,
      name: workspace.name,
      slug: workspace.slug,
      warnings: [],
    };
  },

  team(team: TeamRecord): TeamResourceDto {
    return {
      id: team.id.value,
      version: team.version,
      address: team.key,
      workspaceId: team.workspaceId.value,
      key: team.key,
      name: team.name,
      warnings: [],
    };
  },

  workspaceToken(token: WorkspaceTokenRecord): WorkspaceTokenResourceDto {
    return {
      id: token.id.value,
      version: token.version,
      address: token.name,
      workspaceId: token.workspaceId.value,
      name: token.name,
      description: token.description,
      scopes: token.scopes,
      issuedBy: token.issuedBy,
      issuedAt: token.issuedAt.toISOString(),
      expiresAt: token.expiresAt?.toISOString() ?? null,
      warnings: [],
    };
  },

  oidcTrust(trust: OidcTrustRecord): OidcTrustResourceDto {
    return {
      id: trust.id.value,
      version: trust.version,
      address: trust.key,
      workspaceId: trust.workspaceId.value,
      key: trust.key,
      issuer: trust.issuer,
      audience: trust.audience,
      subject: trust.subject,
      claims: { ...trust.claims },
      scopes: trust.scopes,
      lifetimeMinutes: trust.lifetimeMinutes,
      createdBy: trust.createdBy,
      warnings: [],
    };
  },
};
