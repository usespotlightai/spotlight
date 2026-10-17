import type {
  IdentityResourcesPort,
  TeamRecord,
  WorkspaceRecord,
  WorkspaceTokenRecord,
  WorkspaceTokenTrustRecord,
} from '@identity/application/ports/identity-resources.port';
import {
  team,
  workspace,
  workspaceMember,
  workspaceToken,
  workspaceTokenTrust,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';
import { and, asc, eq, isNotNull, isNull, type SQL } from 'drizzle-orm';

const KEPT_WORKSPACE = {
  id: workspace.id,
  version: workspace.version,
  name: workspace.name,
  slug: workspace.slug,
};

const KEPT_TEAM = {
  id: team.id,
  version: team.version,
  workspaceId: team.workspaceId,
  key: team.key,
  name: team.name,
};

const KEPT_TOKEN = {
  id: workspaceToken.id,
  version: workspaceToken.version,
  workspaceId: workspaceToken.workspaceId,
  name: workspaceToken.name,
  description: workspaceToken.description,
  scopes: workspaceToken.scopes,
  issuedBy: workspaceToken.issuedBy,
  issuedAt: workspaceToken.issuedAt,
  expiresAt: workspaceToken.expiresAt,
};

const KEPT_TRUST = {
  id: workspaceTokenTrust.id,
  version: workspaceTokenTrust.version,
  workspaceId: workspaceTokenTrust.workspaceId,
  key: workspaceTokenTrust.key,
  issuer: workspaceTokenTrust.issuer,
  audience: workspaceTokenTrust.audience,
  subject: workspaceTokenTrust.subject,
  claims: workspaceTokenTrust.claims,
  scopes: workspaceTokenTrust.scopes,
  lifetimeMinutes: workspaceTokenTrust.lifetimeMinutes,
  createdBy: workspaceTokenTrust.createdBy,
};

const issuedByHand = and(
  isNull(workspaceToken.issuedByTrustId),
  isNull(workspaceToken.runId),
);

type Row<Kept> = Omit<Kept, 'id' | 'workspaceId'> & {
  readonly id: string;
  readonly workspaceId: string;
};

const keptWorkspace = (
  row: Omit<WorkspaceRecord, 'id'> & { readonly id: string },
): WorkspaceRecord => ({ ...row, id: WorkspaceId.of(row.id) });

const keptTeam = (row: Row<TeamRecord>): TeamRecord => ({
  ...row,
  id: TeamId.of(row.id),
  workspaceId: WorkspaceId.of(row.workspaceId),
});

const keptToken = (row: Row<WorkspaceTokenRecord>): WorkspaceTokenRecord => ({
  ...row,
  id: WorkspaceTokenId.of(row.id),
  workspaceId: WorkspaceId.of(row.workspaceId),
});

const keptTrust = (
  row: Row<WorkspaceTokenTrustRecord>,
): WorkspaceTokenTrustRecord => ({
  ...row,
  id: WorkspaceTokenTrustId.of(row.id),
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
        .select(KEPT_WORKSPACE)
        .from(workspace)
        .innerJoin(
          workspaceMember,
          eq(workspaceMember.workspaceId, workspace.id),
        )
        .where(eq(workspaceMember.userId, userId.value))
    ).map(keptWorkspace);
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
        .select(KEPT_TEAM)
        .from(team)
        .where(eq(team.workspaceId, workspaceId.value))
    ).map(keptTeam);
  }

  async teamKeysIn(workspaceId: WorkspaceId): Promise<readonly string[]> {
    return (
      await this.context.db
        .select({ key: team.key })
        .from(team)
        .where(eq(team.workspaceId, workspaceId.value))
        .orderBy(asc(team.key))
    ).map((each) => each.key);
  }

  async tokenNamesIn(workspaceId: WorkspaceId): Promise<readonly string[]> {
    return (
      await this.context.db
        .select({ name: workspaceToken.name })
        .from(workspaceToken)
        .where(
          and(eq(workspaceToken.workspaceId, workspaceId.value), issuedByHand),
        )
        .orderBy(asc(workspaceToken.name))
    ).map((each) => each.name);
  }

  async issuingTrustKeysIn(
    workspaceId: WorkspaceId,
  ): Promise<readonly string[]> {
    return (
      await this.context.db
        .selectDistinct({ name: workspaceToken.name })
        .from(workspaceToken)
        .where(
          and(
            eq(workspaceToken.workspaceId, workspaceId.value),
            isNotNull(workspaceToken.issuedByTrustId),
          ),
        )
        .orderBy(asc(workspaceToken.name))
    ).map((each) => each.name);
  }

  async tokensIn(
    workspaceId: WorkspaceId,
  ): Promise<readonly WorkspaceTokenRecord[]> {
    return (
      await this.context.db
        .select(KEPT_TOKEN)
        .from(workspaceToken)
        .where(
          and(eq(workspaceToken.workspaceId, workspaceId.value), issuedByHand),
        )
    ).map(keptToken);
  }

  tokenWithId(id: WorkspaceTokenId): Promise<WorkspaceTokenRecord | null> {
    return this.token(eq(workspaceToken.id, id.value));
  }

  tokenAt(
    workspaceId: WorkspaceId,
    name: string,
  ): Promise<WorkspaceTokenRecord | null> {
    return this.token(
      and(
        eq(workspaceToken.workspaceId, workspaceId.value),
        eq(workspaceToken.name, name),
        issuedByHand,
      ),
    );
  }

  private async token(
    where: SQL | undefined,
  ): Promise<WorkspaceTokenRecord | null> {
    const [found] = await this.context.db
      .select(KEPT_TOKEN)
      .from(workspaceToken)
      .where(where)
      .limit(1);

    return found ? keptToken(found) : null;
  }

  tokenTrustWithId(
    id: WorkspaceTokenTrustId,
  ): Promise<WorkspaceTokenTrustRecord | null> {
    return this.tokenTrust(eq(workspaceTokenTrust.id, id.value));
  }

  tokenTrustAt(
    workspaceId: WorkspaceId,
    key: string,
  ): Promise<WorkspaceTokenTrustRecord | null> {
    return this.tokenTrust(
      and(
        eq(workspaceTokenTrust.workspaceId, workspaceId.value),
        eq(workspaceTokenTrust.key, key),
      ),
    );
  }

  async tokenTrustsIn(
    workspaceId: WorkspaceId,
  ): Promise<readonly WorkspaceTokenTrustRecord[]> {
    return (
      await this.context.db
        .select(KEPT_TRUST)
        .from(workspaceTokenTrust)
        .where(eq(workspaceTokenTrust.workspaceId, workspaceId.value))
    ).map(keptTrust);
  }

  async tokenTrustKeysIn(workspaceId: WorkspaceId): Promise<readonly string[]> {
    return (
      await this.context.db
        .select({ key: workspaceTokenTrust.key })
        .from(workspaceTokenTrust)
        .where(eq(workspaceTokenTrust.workspaceId, workspaceId.value))
        .orderBy(asc(workspaceTokenTrust.key))
    ).map((each) => each.key);
  }

  private async tokenTrust(
    where: SQL | undefined,
  ): Promise<WorkspaceTokenTrustRecord | null> {
    const [found] = await this.context.db
      .select(KEPT_TRUST)
      .from(workspaceTokenTrust)
      .where(where)
      .limit(1);

    return found ? keptTrust(found) : null;
  }

  private async workspace(where: SQL): Promise<WorkspaceRecord | null> {
    const [found] = await this.context.db
      .select(KEPT_WORKSPACE)
      .from(workspace)
      .where(where)
      .limit(1);

    return found ? keptWorkspace(found) : null;
  }

  private async team(where: SQL | undefined): Promise<TeamRecord | null> {
    const [found] = await this.context.db
      .select(KEPT_TEAM)
      .from(team)
      .where(where)
      .limit(1);

    return found ? keptTeam(found) : null;
  }
}
