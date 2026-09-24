import type {
  IdentityResourcesPort,
  KeptTeam,
  KeptWorkspace,
  KeptWorkspaceToken,
} from '@identity/application/ports/identity-resources.port';
import {
  team,
  workspace,
  workspaceToken,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { and, asc, eq, type SQL } from 'drizzle-orm';

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

@Injectable()
export class DrizzleIdentityResources implements IdentityResourcesPort {
  constructor(private readonly context: DrizzleContext) {}

  workspaceWithId(id: WorkspaceId): Promise<KeptWorkspace | null> {
    return this.workspace(eq(workspace.id, id.value));
  }

  workspaceWithSlug(slug: string): Promise<KeptWorkspace | null> {
    return this.workspace(eq(workspace.slug, slug));
  }

  teamWithId(id: TeamId): Promise<KeptTeam | null> {
    return this.team(eq(team.id, id.value));
  }

  teamAt(workspaceId: WorkspaceId, key: string): Promise<KeptTeam | null> {
    return this.team(
      and(eq(team.workspaceId, workspaceId.value), eq(team.key, key)),
    );
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
        .where(eq(workspaceToken.workspaceId, workspaceId.value))
        .orderBy(asc(workspaceToken.name))
    ).map((each) => each.name);
  }

  tokenWithId(id: WorkspaceTokenId): Promise<KeptWorkspaceToken | null> {
    return this.token(eq(workspaceToken.id, id.value));
  }

  tokenAt(
    workspaceId: WorkspaceId,
    name: string,
  ): Promise<KeptWorkspaceToken | null> {
    return this.token(
      and(
        eq(workspaceToken.workspaceId, workspaceId.value),
        eq(workspaceToken.name, name),
      ),
    );
  }

  private async token(
    where: SQL | undefined,
  ): Promise<KeptWorkspaceToken | null> {
    const [found] = await this.context.db
      .select(KEPT_TOKEN)
      .from(workspaceToken)
      .where(where)
      .limit(1);

    return found
      ? {
          ...found,
          id: WorkspaceTokenId.of(found.id),
          workspaceId: WorkspaceId.of(found.workspaceId),
        }
      : null;
  }

  private async workspace(where: SQL): Promise<KeptWorkspace | null> {
    const [found] = await this.context.db
      .select(KEPT_WORKSPACE)
      .from(workspace)
      .where(where)
      .limit(1);

    return found ? { ...found, id: WorkspaceId.of(found.id) } : null;
  }

  private async team(where: SQL | undefined): Promise<KeptTeam | null> {
    const [found] = await this.context.db
      .select(KEPT_TEAM)
      .from(team)
      .where(where)
      .limit(1);

    return found
      ? {
          ...found,
          id: TeamId.of(found.id),
          workspaceId: WorkspaceId.of(found.workspaceId),
        }
      : null;
  }
}
