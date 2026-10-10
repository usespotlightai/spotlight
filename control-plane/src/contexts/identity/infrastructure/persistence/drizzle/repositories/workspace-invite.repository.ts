import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { WorkspaceInviteOffered } from '@identity/domain/events/workspace-invite-offered.event';
import { AlreadyInvitedError } from '@identity/domain/exceptions/already-invited.error';
import { InviteMovedOnError } from '@identity/domain/exceptions/invite-moved-on.error';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteTerms } from '@identity/domain/value-objects/invite-terms.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import {
  team,
  workspaceInvite,
  workspaceInviteTeam,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, desc, eq, inArray, isNull, type SQL, sql } from 'drizzle-orm';

type Row = typeof workspaceInvite.$inferSelect;

@Injectable()
export class DrizzleWorkspaceInviteRepository
  implements WorkspaceInviteRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: WorkspaceInvite): Promise<void> {
    await this.context.run(async () => {
      await this.inserted(added);
      await this.teamsWritten(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: WorkspaceInvite): Promise<void> {
    try {
      await this.context.db.insert(workspaceInvite).values(this.written(added));
    } catch (error) {
      if (
        violates(error, UNIQUE_VIOLATION, 'workspace_invite_workspace_email')
      ) {
        throw new AlreadyInvitedError(added.email.value);
      }
      throw error;
    }
  }

  async save(saved: WorkspaceInvite): Promise<void> {
    await this.context.run(async () => {
      const events = saved.pullEvents();

      await this.stored(saved);

      if (events.some((each) => each instanceof WorkspaceInviteOffered)) {
        await this.teamsWritten(saved);
      }

      await this.events.dispatch(events);
    });
  }

  private async stored(saved: WorkspaceInvite): Promise<void> {
    const { id, workspaceId, email, ...rest } = this.written(saved);

    const written = await this.context.db
      .update(workspaceInvite)
      .set({ ...rest, version: saved.version + 1 })
      .where(
        and(
          eq(workspaceInvite.id, id),
          eq(workspaceInvite.version, saved.version),
        ),
      )
      .returning({ id: workspaceInvite.id });

    if (written.length === 0) {
      throw new InviteMovedOnError(id);
    }
  }

  private async teamsWritten(held: WorkspaceInvite): Promise<void> {
    const teams = held.terms.teams.map((each) => each.value);

    await this.context.db
      .delete(workspaceInviteTeam)
      .where(eq(workspaceInviteTeam.inviteId, held.id.value));

    if (teams.length === 0) {
      return;
    }

    await this.context.db.insert(workspaceInviteTeam).select(
      this.context.db
        .select({
          inviteId: sql<string>`${held.id.value}::text`.as('invite_id'),
          teamId: team.id,
        })
        .from(team)
        .where(inArray(team.id, teams)),
    );
  }

  async find(id: InviteId): Promise<WorkspaceInvite | null> {
    return this.first(eq(workspaceInvite.id, id.value));
  }

  async withToken(hash: TokenHash): Promise<WorkspaceInvite | null> {
    return this.first(eq(workspaceInvite.tokenHash, hash.value));
  }

  async openTo(
    workspaceId: WorkspaceId,
    email: EmailAddress,
  ): Promise<WorkspaceInvite | null> {
    return this.first(
      and(
        eq(workspaceInvite.workspaceId, workspaceId.value),
        sql`lower(${workspaceInvite.email}) = ${email.value}`,
        isNull(workspaceInvite.acceptedAt),
        isNull(workspaceInvite.revokedAt),
      ),
    );
  }

  private async first(
    condition: SQL | undefined,
  ): Promise<WorkspaceInvite | null> {
    const [found] = await this.context.db
      .select()
      .from(workspaceInvite)
      .where(condition)
      .orderBy(desc(workspaceInvite.invitedAt))
      .limit(1);

    if (!found) {
      return null;
    }

    const joining = await this.context.db
      .select({ teamId: workspaceInviteTeam.teamId })
      .from(workspaceInviteTeam)
      .where(eq(workspaceInviteTeam.inviteId, found.id));

    return this.rehydrated(
      found,
      joining.map((each) => TeamId.of(each.teamId)),
    );
  }

  private written(held: WorkspaceInvite) {
    return {
      id: held.id.value,
      workspaceId: held.workspaceId.value,
      email: held.email.value,
      role: held.terms.role.value,
      tokenHash: held.tokenHash.value,
      invitedBy: held.invitedBy?.value ?? null,
      invitedAt: held.invitedAt,
      expiresAt: held.expiresAt,
      acceptedAt: held.acceptedAt,
      acceptedBy: held.acceptedBy?.value ?? null,
      revokedAt: held.revokedAt,
    };
  }

  private rehydrated(row: Row, teams: readonly TeamId[]): WorkspaceInvite {
    return WorkspaceInvite.rehydrate({
      id: InviteId.of(row.id),
      workspaceId: WorkspaceId.of(row.workspaceId),
      email: EmailAddress.of(row.email),
      terms: InviteTerms.of(WorkspaceRole.of(row.role), teams),
      tokenHash: TokenHash.of(row.tokenHash),
      invitedBy: row.invitedBy ? UserId.of(row.invitedBy) : null,
      invitedAt: row.invitedAt,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      acceptedBy: row.acceptedBy ? UserId.of(row.acceptedBy) : null,
      revokedAt: row.revokedAt,
      version: row.version,
    });
  }
}
