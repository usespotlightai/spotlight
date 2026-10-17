import type {
  MemberReaderPort,
  TeamRoster,
  WorkspaceMemberSummary,
} from '@identity/application/ports/member-reader.port';
import type { TeamNamed } from '@identity/application/read-models/team-named';
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
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq } from 'drizzle-orm';

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
        name: row.name,
        image: row.image,
        role: row.role,
      })),
      viewer: visible.viewer,
      owners: owners.length,
    };
  }

  async listForWorkspace(
    workspaceId: WorkspaceId,
  ): Promise<readonly WorkspaceMemberSummary[]> {
    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: workspaceMember.role,
        joinedAt: workspaceMember.createdAt,
      })
      .from(workspaceMember)
      .innerJoin(user, eq(user.id, workspaceMember.userId))
      .where(eq(workspaceMember.workspaceId, workspaceId.value))
      .orderBy(asc(user.name));

    const onTeams = await this.db
      .select({ userId: teamMember.userId, id: team.id, name: team.name })
      .from(teamMember)
      .innerJoin(team, eq(team.id, teamMember.teamId))
      .where(eq(team.workspaceId, workspaceId.value))
      .orderBy(asc(team.name));

    const teamsOf = new Map<string, TeamNamed[]>();

    for (const each of onTeams) {
      const memberTeams = teamsOf.get(each.userId) ?? [];

      memberTeams.push({ id: each.id, name: each.name });
      teamsOf.set(each.userId, memberTeams);
    }

    return rows.map((row) => ({ ...row, teams: teamsOf.get(row.id) ?? [] }));
  }
}
