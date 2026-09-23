import type {
  IdentityResourcesPort,
  KeptTeam,
  KeptWorkspace,
} from '@identity/application/ports/identity-resources.port';
import {
  team,
  workspace,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
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
