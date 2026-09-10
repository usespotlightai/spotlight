import type { MemberReaderPort } from '@application/ports/member-reader.port';
import type { PersonSummary } from '@application/ports/person-reader.port';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import type { DrizzleDatabase } from '@infrastructure/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@infrastructure/persistence/drizzle/drizzle.constants';
import { user } from '@infrastructure/persistence/drizzle/schemas/auth.schema';
import {
  team,
  teamMember,
  workspaceMember,
} from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleMemberReader implements MemberReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async listForTeam(
    teamId: TeamId,
    viewerId: UserId,
  ): Promise<PersonSummary[] | null> {
    // Whoever asks has to be able to see the team at all, the same way its
    // tasks are guarded.
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
      .select({ id: user.id, name: user.name, image: user.image })
      .from(teamMember)
      .innerJoin(user, eq(user.id, teamMember.userId))
      .where(eq(teamMember.teamId, teamId.value))
      .orderBy(asc(user.name));

    return rows.map((row) => ({
      id: row.id,
      name: row.name ?? '',
      image: row.image,
    }));
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
}
