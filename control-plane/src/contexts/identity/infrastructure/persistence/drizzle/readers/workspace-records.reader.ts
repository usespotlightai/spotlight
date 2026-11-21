import type {
  WorkspaceListing,
  WorkspaceProfile,
} from '@identity/application/ports/workspace-reader.port';
import type {
  TeamSummary,
  WorkspaceRecordsPort,
} from '@identity/application/ports/workspace-records.port';
import { avatar } from '@identity/infrastructure/persistence/drizzle/schemas/avatar.schema';
import {
  team,
  workspace,
  workspaceMember,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, isNull } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkspaceRecords implements WorkspaceRecordsPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async idForSlug(slug: string): Promise<string | null> {
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

  async profileOf(workspaceId: string): Promise<WorkspaceProfile | null> {
    const [found] = await this.db
      .select({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        outboundHosts: workspace.outboundHosts,
      })
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1);

    return found ?? null;
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

  async listingsOf(person: UserId): Promise<WorkspaceListing[]> {
    return this.db
      .select({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        avatarDigest: avatar.digest,
        role: workspaceMember.role,
      })
      .from(workspaceMember)
      .innerJoin(workspace, eq(workspace.id, workspaceMember.workspaceId))
      .leftJoin(
        avatar,
        and(
          eq(avatar.workspaceId, workspaceMember.workspaceId),
          isNull(avatar.teamId),
        ),
      )
      .where(eq(workspaceMember.userId, person.value))
      .orderBy(workspace.createdAt);
  }

  async teamsIn(workspaceId: WorkspaceId): Promise<TeamSummary[]> {
    return this.db
      .select({ id: team.id, name: team.name, avatarDigest: avatar.digest })
      .from(team)
      .leftJoin(
        avatar,
        and(eq(avatar.workspaceId, team.workspaceId), eq(avatar.teamId, team.id)),
      )
      .where(eq(team.workspaceId, workspaceId.value))
      .orderBy(team.createdAt);
  }

  async avatarDigestOf(workspaceId: WorkspaceId): Promise<string | null> {
    const [found] = await this.db
      .select({ digest: avatar.digest })
      .from(avatar)
      .where(
        and(eq(avatar.workspaceId, workspaceId.value), isNull(avatar.teamId)),
      )
      .limit(1);

    return found?.digest ?? null;
  }
}
