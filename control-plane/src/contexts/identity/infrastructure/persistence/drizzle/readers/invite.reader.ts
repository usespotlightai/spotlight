import type {
  InviteOffer,
  InviteReaderPort,
  InviteSummary,
} from '@identity/application/ports/invite-reader.port';
import type { TeamNamed } from '@identity/application/read-models/team-named';
import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { invitable } from '@identity/domain/value-objects/invite-terms.vo';
import { user } from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import {
  team,
  workspace,
  workspaceInvite,
  workspaceInviteTeam,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, desc, eq, gt, inArray, isNull } from 'drizzle-orm';

@Injectable()
export class DrizzleInviteReader implements InviteReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async openInWorkspace(
    workspaceId: WorkspaceId,
    now: Date,
  ): Promise<readonly InviteSummary[]> {
    const rows = await this.db
      .select({
        id: workspaceInvite.id,
        email: workspaceInvite.email,
        role: workspaceInvite.role,
        inviterId: user.id,
        inviterName: user.name,
        inviterImage: user.image,
        invitedAt: workspaceInvite.invitedAt,
        expiresAt: workspaceInvite.expiresAt,
      })
      .from(workspaceInvite)
      .leftJoin(user, eq(user.id, workspaceInvite.invitedBy))
      .where(
        and(
          eq(workspaceInvite.workspaceId, workspaceId.value),
          isNull(workspaceInvite.acceptedAt),
          isNull(workspaceInvite.revokedAt),
          gt(workspaceInvite.expiresAt, now),
        ),
      )
      .orderBy(desc(workspaceInvite.invitedAt));

    const teams = await this.teamsOf(rows.map((row) => row.id));

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: invitable(row.role),
      teams: teams.get(row.id) ?? [],
      invitedBy:
        row.inviterId && row.inviterName
          ? {
              id: row.inviterId,
              name: row.inviterName,
              image: row.inviterImage,
            }
          : null,
      invitedAt: row.invitedAt,
      expiresAt: row.expiresAt,
    }));
  }

  async withToken(hash: TokenHash, now: Date): Promise<InviteOffer | null> {
    const [found] = await this.db
      .select({
        id: workspaceInvite.id,
        email: workspaceInvite.email,
        role: workspaceInvite.role,
        workspaceName: workspace.name,
        invitedBy: user.name,
        acceptedAt: workspaceInvite.acceptedAt,
        revokedAt: workspaceInvite.revokedAt,
        expiresAt: workspaceInvite.expiresAt,
      })
      .from(workspaceInvite)
      .innerJoin(workspace, eq(workspace.id, workspaceInvite.workspaceId))
      .leftJoin(user, eq(user.id, workspaceInvite.invitedBy))
      .where(eq(workspaceInvite.tokenHash, hash.value))
      .limit(1);

    if (!found) {
      return null;
    }

    const teams = await this.teamsOf([found.id]);

    return {
      email: found.email,
      workspaceName: found.workspaceName,
      invitedBy: found.invitedBy,
      role: invitable(found.role),
      teamNames: (teams.get(found.id) ?? []).map((each) => each.name),
      status: WorkspaceInvite.statusOf(found, now),
    };
  }

  private async teamsOf(
    inviteIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly TeamNamed[]>> {
    if (inviteIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        inviteId: workspaceInviteTeam.inviteId,
        id: team.id,
        name: team.name,
      })
      .from(workspaceInviteTeam)
      .innerJoin(team, eq(team.id, workspaceInviteTeam.teamId))
      .where(inArray(workspaceInviteTeam.inviteId, [...inviteIds]))
      .orderBy(asc(team.name));

    const teams = new Map<string, TeamNamed[]>();

    for (const row of rows) {
      const inviteTeams = teams.get(row.inviteId) ?? [];

      inviteTeams.push({ id: row.id, name: row.name });
      teams.set(row.inviteId, inviteTeams);
    }

    return teams;
  }
}
