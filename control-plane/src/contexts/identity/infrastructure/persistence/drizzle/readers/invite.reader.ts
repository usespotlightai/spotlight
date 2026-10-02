import type {
  InviteOffer,
  InviteReaderPort,
  InviteSummary,
} from '@identity/application/ports/invite-reader.port';
import type { InviteStatus } from '@identity/domain/aggregates/invite.aggregate';
import { user } from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import {
  team,
  teamInvite,
  workspace,
  workspaceMember,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';

@Injectable()
export class DrizzleInviteReader implements InviteReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async openForTeam(
    teamId: TeamId,
    viewerId: UserId,
  ): Promise<InviteSummary[] | null> {
    const [visible] = await this.db
      .select({ id: team.id })
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
        id: teamInvite.id,
        email: teamInvite.email,
        invitedBy: user.name,
        invitedAt: teamInvite.invitedAt,
        expiresAt: teamInvite.expiresAt,
      })
      .from(teamInvite)
      .innerJoin(user, eq(user.id, teamInvite.invitedBy))
      .where(
        and(
          eq(teamInvite.teamId, teamId.value),
          isNull(teamInvite.acceptedAt),
          isNull(teamInvite.revokedAt),
          gt(teamInvite.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(teamInvite.invitedAt));

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      invitedBy: row.invitedBy,
      invitedAt: row.invitedAt,
      expiresAt: row.expiresAt,
      standing: 'open' as const,
    }));
  }

  async withToken(hash: TokenHash): Promise<InviteOffer | null> {
    const [found] = await this.db
      .select({
        email: teamInvite.email,
        teamName: team.name,
        workspaceName: workspace.name,
        invitedBy: user.name,
        acceptedAt: teamInvite.acceptedAt,
        revokedAt: teamInvite.revokedAt,
        expiresAt: teamInvite.expiresAt,
      })
      .from(teamInvite)
      .innerJoin(team, eq(team.id, teamInvite.teamId))
      .innerJoin(workspace, eq(workspace.id, teamInvite.workspaceId))
      .innerJoin(user, eq(user.id, teamInvite.invitedBy))
      .where(eq(teamInvite.tokenHash, hash.value))
      .limit(1);

    if (!found) {
      return null;
    }

    return {
      email: found.email,
      teamName: found.teamName,
      workspaceName: found.workspaceName,
      invitedBy: found.invitedBy,
      standing: standingOf(found),
    };
  }
}

const standingOf = (row: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): InviteStatus => {
  if (row.acceptedAt) {
    return 'accepted';
  }
  if (row.revokedAt) {
    return 'revoked';
  }

  return row.expiresAt <= new Date() ? 'expired' : 'open';
};
