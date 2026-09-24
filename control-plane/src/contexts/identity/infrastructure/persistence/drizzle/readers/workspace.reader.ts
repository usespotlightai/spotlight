import type {
  WorkspaceDetail,
  WorkspaceListing,
  WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import {
  team,
  workspace,
  workspaceMember,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkspaceReader implements WorkspaceReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async identify(slug: string): Promise<string | null> {
    const [found] = await this.db
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.slug, slug))
      .limit(1);

    return found?.id ?? null;
  }

  async slugOf(workspaceId: string): Promise<string | null> {
    const [found] = await this.db
      .select({ slug: workspace.slug })
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1);

    return found?.slug ?? null;
  }

  async isOpen(workspaceId: string): Promise<boolean> {
    return (await this.slugOf(workspaceId)) !== null;
  }

  async identifyTeam(
    slug: string,
    teamKey: string,
  ): Promise<{ workspaceId: string; teamId: string } | null> {
    const [found] = await this.db
      .select({ workspaceId: workspace.id, teamId: team.id })
      .from(team)
      .innerJoin(workspace, eq(workspace.id, team.workspaceId))
      .where(and(eq(workspace.slug, slug), eq(team.key, teamKey)))
      .limit(1);

    return found ?? null;
  }

  async findTeamForMember(
    teamId: string,
    userId: UserId,
  ): Promise<{
    workspaceId: string;
    teamId: string;
    teamKey: string;
    slug: string;
  } | null> {
    const [found] = await this.db
      .select({
        workspaceId: workspace.id,
        teamId: team.id,
        teamKey: team.key,
        slug: workspace.slug,
      })
      .from(team)
      .innerJoin(workspace, eq(workspace.id, team.workspaceId))
      .innerJoin(workspaceMember, eq(workspaceMember.workspaceId, workspace.id))
      .where(and(eq(team.id, teamId), eq(workspaceMember.userId, userId.value)))
      .limit(1);

    return found ?? null;
  }

  async listForMember(userId: UserId): Promise<WorkspaceListing[]> {
    return this.db
      .select({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: workspaceMember.role,
      })
      .from(workspaceMember)
      .innerJoin(workspace, eq(workspace.id, workspaceMember.workspaceId))
      .where(eq(workspaceMember.userId, userId.value))
      .orderBy(workspace.createdAt);
  }

  async findForMember(
    slug: string,
    userId: UserId,
  ): Promise<WorkspaceDetail | null> {
    const [found] = await this.db
      .select({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: workspaceMember.role,
      })
      .from(workspace)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, workspace.id),
          eq(workspaceMember.userId, userId.value),
        ),
      )
      .where(eq(workspace.slug, slug))
      .limit(1);

    if (!found) {
      return null;
    }

    const teams = await this.db
      .select({ id: team.id, name: team.name })
      .from(team)
      .where(eq(team.workspaceId, found.id))
      .orderBy(team.createdAt);

    return { ...found, teams };
  }
}
