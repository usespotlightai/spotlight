import type {
  IdentityResourcesPort,
  OidcTrustRecord,
  TeamRecord,
  WorkspaceRecord,
  WorkspaceTokenRecord,
} from '@identity/application/ports/identity-resources.port';
import { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { OidcTrustId } from '@identity/domain/value-objects/oidc-trust-id.vo';
import { WorkspaceTokenId } from '@identity/domain/value-objects/workspace-token-id.vo';
import {
  oidcTrust,
  team,
  workspace,
  workspaceMember,
  workspaceToken,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

const WORKSPACE_COLUMNS = {
  id: workspace.id,
  version: workspace.version,
  name: workspace.name,
  slug: workspace.slug,
  outboundHosts: workspace.outboundHosts,
};

const TEAM_COLUMNS = {
  id: team.id,
  version: team.version,
  workspaceId: team.workspaceId,
  key: team.key,
  name: team.name,
};

const TOKEN_COLUMNS = {
  id: workspaceToken.id,
  version: workspaceToken.version,
  workspaceId: workspaceToken.workspaceId,
  name: workspaceToken.name,
  description: workspaceToken.description,
  scopes: workspaceToken.scopes,
  issuedBy: workspaceToken.issuedById,
  issuedAt: workspaceToken.issuedAt,
  expiresAt: workspaceToken.expiresAt,
  issuedByTrustId: workspaceToken.issuedByTrustId,
  runId: workspaceToken.runId,
};

const TRUST_COLUMNS = {
  id: oidcTrust.id,
  version: oidcTrust.version,
  workspaceId: oidcTrust.workspaceId,
  key: oidcTrust.key,
  issuer: oidcTrust.issuer,
  audience: oidcTrust.audience,
  subject: oidcTrust.subject,
  claims: oidcTrust.claims,
  scopes: oidcTrust.scopes,
  lifetimeMinutes: oidcTrust.lifetimeMinutes,
  description: oidcTrust.description,
  createdBy: oidcTrust.createdById,
};

const issuedByHand = (row: {
  readonly issuedByTrustId: string | null;
  readonly runId: string | null;
}): boolean => !WorkspaceToken.issuedBySpotlight(row);

type Row<T> = Omit<T, 'id' | 'workspaceId'> & {
  readonly id: string;
  readonly workspaceId: string;
};

const workspaceRecordOf = (
  row: Omit<WorkspaceRecord, 'id'> & { readonly id: string },
): WorkspaceRecord => ({ ...row, id: WorkspaceId.of(row.id) });

const teamRecordOf = (row: Row<TeamRecord>): TeamRecord => ({
  ...row,
  id: TeamId.of(row.id),
  workspaceId: WorkspaceId.of(row.workspaceId),
});

const tokenRecordOf = ({
  issuedByTrustId: _trust,
  runId: _run,
  ...row
}: Row<WorkspaceTokenRecord> & {
  readonly issuedByTrustId: string | null;
  readonly runId: string | null;
}): WorkspaceTokenRecord => ({
  ...row,
  id: WorkspaceTokenId.of(row.id),
  workspaceId: WorkspaceId.of(row.workspaceId),
});

const trustRecordOf = (row: Row<OidcTrustRecord>): OidcTrustRecord => ({
  ...row,
  id: OidcTrustId.of(row.id),
  workspaceId: WorkspaceId.of(row.workspaceId),
});

@Injectable()
export class DrizzleIdentityResources implements IdentityResourcesPort {
  constructor(private readonly context: DrizzleContext) {}

  workspaceWithId(id: WorkspaceId): Promise<WorkspaceRecord | null> {
    return this.workspace(eq(workspace.id, id.value));
  }

  workspaceWithSlug(slug: string): Promise<WorkspaceRecord | null> {
    return this.workspace(eq(workspace.slug, slug));
  }

  async workspacesJoinedBy(
    userId: UserId,
  ): Promise<readonly WorkspaceRecord[]> {
    return (
      await this.context.db
        .select(WORKSPACE_COLUMNS)
        .from(workspace)
        .innerJoin(
          workspaceMember,
          eq(workspaceMember.workspaceId, workspace.id),
        )
        .where(eq(workspaceMember.userId, userId.value))
    ).map(workspaceRecordOf);
  }

  teamWithId(id: TeamId): Promise<TeamRecord | null> {
    return this.team(eq(team.id, id.value));
  }

  teamAt(workspaceId: WorkspaceId, key: string): Promise<TeamRecord | null> {
    return this.team(
      and(eq(team.workspaceId, workspaceId.value), eq(team.key, key)),
    );
  }

  async teamsIn(workspaceId: WorkspaceId): Promise<readonly TeamRecord[]> {
    return (
      await this.context.db
        .select(TEAM_COLUMNS)
        .from(team)
        .where(eq(team.workspaceId, workspaceId.value))
    ).map(teamRecordOf);
  }

  async tokensIn(
    workspaceId: WorkspaceId,
  ): Promise<readonly WorkspaceTokenRecord[]> {
    return (
      await this.context.db
        .select(TOKEN_COLUMNS)
        .from(workspaceToken)
        .where(eq(workspaceToken.workspaceId, workspaceId.value))
    )
      .filter(issuedByHand)
      .map(tokenRecordOf);
  }

  async tokenWithId(
    id: WorkspaceTokenId,
  ): Promise<WorkspaceTokenRecord | null> {
    const [found] = await this.tokens(eq(workspaceToken.id, id.value));

    return found ? tokenRecordOf(found) : null;
  }

  async tokenAt(
    workspaceId: WorkspaceId,
    name: string,
  ): Promise<WorkspaceTokenRecord | null> {
    const found = (
      await this.tokens(
        and(
          eq(workspaceToken.workspaceId, workspaceId.value),
          eq(workspaceToken.name, name),
        ),
      )
    ).find(issuedByHand);

    return found ? tokenRecordOf(found) : null;
  }

  private tokens(where: SQL | undefined) {
    return this.context.db
      .select(TOKEN_COLUMNS)
      .from(workspaceToken)
      .where(where);
  }

  oidcTrustWithId(id: OidcTrustId): Promise<OidcTrustRecord | null> {
    return this.oidcTrust(eq(oidcTrust.id, id.value));
  }

  oidcTrustAt(
    workspaceId: WorkspaceId,
    key: string,
  ): Promise<OidcTrustRecord | null> {
    return this.oidcTrust(
      and(eq(oidcTrust.workspaceId, workspaceId.value), eq(oidcTrust.key, key)),
    );
  }

  async oidcTrustsIn(
    workspaceId: WorkspaceId,
  ): Promise<readonly OidcTrustRecord[]> {
    return (
      await this.context.db
        .select(TRUST_COLUMNS)
        .from(oidcTrust)
        .where(eq(oidcTrust.workspaceId, workspaceId.value))
    ).map(trustRecordOf);
  }

  private async oidcTrust(
    where: SQL | undefined,
  ): Promise<OidcTrustRecord | null> {
    const [found] = await this.context.db
      .select(TRUST_COLUMNS)
      .from(oidcTrust)
      .where(where)
      .limit(1);

    return found ? trustRecordOf(found) : null;
  }

  private async workspace(where: SQL): Promise<WorkspaceRecord | null> {
    const [found] = await this.context.db
      .select(WORKSPACE_COLUMNS)
      .from(workspace)
      .where(where)
      .limit(1);

    return found ? workspaceRecordOf(found) : null;
  }

  private async team(where: SQL | undefined): Promise<TeamRecord | null> {
    const [found] = await this.context.db
      .select(TEAM_COLUMNS)
      .from(team)
      .where(where)
      .limit(1);

    return found ? teamRecordOf(found) : null;
  }
}
