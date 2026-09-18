import type {
  MemberReaderPort,
  TeamRoster,
} from '@identity/application/ports/member-reader.port';
import { user } from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import {
  team,
  teamMember,
  workspaceMember,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleMemberReader implements MemberReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listForTeam(
    teamId: TeamId,
    viewerId: UserId,
  ): Promise<TeamRoster | null> {
    const [visible] = await this.db
      .select({
        workspaceId: team.workspaceId,
        viewer: workspaceMember.role,
      })
      .from(team)
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, team.workspaceId),
          eq(workspaceMember.userId, viewerId.value),
        ),
      )
      .where(eq(team.id, teamId.value))
      .limit(1);

    if (!visible) {
      return null;
    }

    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        image: user.image,
        role: workspaceMember.role,
      })
      .from(teamMember)
      .innerJoin(user, eq(user.id, teamMember.userId))
      .innerJoin(
        workspaceMember,
        and(
          eq(workspaceMember.workspaceId, visible.workspaceId),
          eq(workspaceMember.userId, teamMember.userId),
        ),
      )
      .where(eq(teamMember.teamId, teamId.value))
      .orderBy(asc(user.name));

    const owners = await this.db
      .select({ userId: workspaceMember.userId })
      .from(workspaceMember)
      .where(
        and(
          eq(workspaceMember.workspaceId, visible.workspaceId),
          eq(workspaceMember.role, 'owner'),
        ),
      );

    return {
      members: rows.map((row) => ({
        id: row.id,
        name: row.name ?? '',
        image: row.image,
        role: row.role,
      })),
      viewer: visible.viewer,
      owners: owners.length,
    };
  }

  async byEmail(
    workspaceId: WorkspaceId,
    email: string,
  ): Promise<UserId | null> {
    const wanted = email.trim();

    if (wanted.length === 0) {
      return null;
    }

    const [found] = await this.db
      .select({ id: user.id })
      .from(workspaceMember)
      .innerJoin(user, eq(user.id, workspaceMember.userId))
      .where(
        and(
          eq(workspaceMember.workspaceId, workspaceId.value),
          sql`lower(${user.email}) = lower(${wanted})`,
        ),
      )
      .limit(1);

    return found ? UserId.of(found.id) : null;
  }

  async onTeam(teamId: TeamId, email: string): Promise<boolean> {
    const wanted = email.trim();

    if (wanted.length === 0) {
      return false;
    }

    const [found] = await this.db
      .select({ id: user.id })
      .from(teamMember)
      .innerJoin(user, eq(user.id, teamMember.userId))
      .where(
        and(
          eq(teamMember.teamId, teamId.value),
          sql`lower(${user.email}) = lower(${wanted})`,
        ),
      )
      .limit(1);

    return found !== undefined;
  }
}
