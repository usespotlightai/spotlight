import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { WorkspaceInviteCreated } from '@identity/domain/events/workspace-invite-created.event';
import { AlreadyInvitedError } from '@identity/domain/exceptions/already-invited.error';
import { InviteVersionConflictError } from '@identity/domain/exceptions/invite-version-conflict.error';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteSpec } from '@identity/domain/value-objects/invite-spec.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import {
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
import { and, desc, eq, type SQL, sql } from 'drizzle-orm';

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
    await this.context.inTransaction(async () => {
      await this.inserted(added);
      await this.teamsWritten(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: WorkspaceInvite): Promise<void> {
    try {
      await this.context.db
        .insert(workspaceInvite)
        .values({ ...this.written(added), version: added.version });
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
    await this.context.inTransaction(async () => {
      const events = saved.pullEvents();

      await this.stored(saved);

      if (events.some((each) => each instanceof WorkspaceInviteCreated)) {
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
      throw new InviteVersionConflictError(id);
    }
  }

  private async teamsWritten(invite: WorkspaceInvite): Promise<void> {
    const teams = invite.spec.teams.map((each) => each.value);

    await this.context.db
      .delete(workspaceInviteTeam)
      .where(eq(workspaceInviteTeam.inviteId, invite.id.value));

    if (teams.length === 0) {
      return;
    }

    await this.context.db
      .insert(workspaceInviteTeam)
      .values(teams.map((teamId) => ({ inviteId: invite.id.value, teamId })));
  }

  async remove(removed: WorkspaceInvite): Promise<void> {
    await this.context.inTransaction(async () => {
      const deleted = await this.context.db
        .delete(workspaceInvite)
        .where(
          and(
            eq(workspaceInvite.id, removed.id.value),
            eq(workspaceInvite.version, removed.version),
          ),
        )
        .returning({ id: workspaceInvite.id });

      if (deleted.length === 0) {
        throw new InviteVersionConflictError(removed.id.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }

  async ofWorkspace(
    workspaceId: WorkspaceId,
  ): Promise<readonly WorkspaceInvite[]> {
    const rows = await this.context.db
      .select()
      .from(workspaceInvite)
      .where(eq(workspaceInvite.workspaceId, workspaceId.value));

    return Promise.all(rows.map((row) => this.withTeams(row)));
  }

  async find(id: InviteId): Promise<WorkspaceInvite | null> {
    return this.first(eq(workspaceInvite.id, id.value));
  }

  async withToken(hash: TokenHash): Promise<WorkspaceInvite | null> {
    return this.first(eq(workspaceInvite.tokenHash, hash.value));
  }

  async latestTo(
    workspaceId: WorkspaceId,
    email: EmailAddress,
  ): Promise<WorkspaceInvite | null> {
    return this.first(
      and(
        eq(workspaceInvite.workspaceId, workspaceId.value),
        sql`lower(${workspaceInvite.email}) = ${email.value}`,
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

    return found ? this.withTeams(found) : null;
  }

  private async withTeams(row: Row): Promise<WorkspaceInvite> {
    const joining = await this.context.db
      .select({ teamId: workspaceInviteTeam.teamId })
      .from(workspaceInviteTeam)
      .where(eq(workspaceInviteTeam.inviteId, row.id));

    return this.rehydrated(
      row,
      joining.map((each) => TeamId.of(each.teamId)),
    );
  }

  private written(invite: WorkspaceInvite) {
    return {
      id: invite.id.value,
      workspaceId: invite.workspaceId.value,
      email: invite.email.value,
      role: invite.spec.role.value,
      tokenHash: invite.tokenHash.value,
      invitedById: invite.invitedBy?.value ?? null,
      invitedAt: invite.invitedAt,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
      acceptedById: invite.acceptedBy?.value ?? null,
      revokedAt: invite.revokedAt,
    } satisfies typeof workspaceInvite.$inferInsert;
  }

  private rehydrated(row: Row, teams: readonly TeamId[]): WorkspaceInvite {
    return WorkspaceInvite.rehydrate({
      id: InviteId.of(row.id),
      workspaceId: WorkspaceId.of(row.workspaceId),
      email: EmailAddress.of(row.email),
      spec: InviteSpec.of(WorkspaceRole.of(row.role), teams),
      tokenHash: TokenHash.of(row.tokenHash),
      invitedBy: row.invitedById ? UserId.of(row.invitedById) : null,
      invitedAt: row.invitedAt,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      acceptedBy: row.acceptedById ? UserId.of(row.acceptedById) : null,
      revokedAt: row.revokedAt,
      version: row.version,
    });
  }
}
