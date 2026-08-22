import type {
  WorkspaceDetail,
  WorkspaceListing,
  WorkspaceReaderPort,
} from '@application/ports/workspace-reader.port';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import {
  team,
  workspace,
  workspaceMember,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkspaceReader implements WorkspaceReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

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
      .select({ id: workspace.id, name: workspace.name, slug: workspace.slug })
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
