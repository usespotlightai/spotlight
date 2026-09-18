import { Invite } from '@identity/domain/aggregates/invite.aggregate';
import { AlreadyInvitedError } from '@identity/domain/exceptions/already-invited.error';
import { InviteMovedOnError } from '@identity/domain/exceptions/invite-moved-on.error';
import type { InviteRepository } from '@identity/domain/repositories/invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { teamInvite } from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, desc, eq } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505';

const isSecondInvite = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === UNIQUE_VIOLATION;

interface Row {
  readonly id: string;
  readonly teamId: string;
  readonly workspaceId: string;
  readonly email: string;
  readonly tokenHash: string;
  readonly invitedBy: string;
  readonly invitedAt: Date;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly acceptedBy: string | null;
  readonly revokedAt: Date | null;
  readonly version: number;
}

@Injectable()
export class DrizzleInviteRepository implements InviteRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Invite): Promise<void> {
    await this.context.run(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: Invite): Promise<void> {
    try {
      await this.context.db.insert(teamInvite).values(this.written(added));
    } catch (error) {
      if (isSecondInvite(error)) {
        throw new AlreadyInvitedError(added.email.value);
      }
      throw error;
    }
  }

  async save(saved: Invite): Promise<void> {
    await this.context.run(async () => {
      await this.stored(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async stored(saved: Invite): Promise<void> {
    const { id, teamId, workspaceId, email, ...rest } = this.written(saved);

    const written = await this.context.db
      .update(teamInvite)
      .set({ ...rest, version: saved.version + 1 })
      .where(and(eq(teamInvite.id, id), eq(teamInvite.version, saved.version)))
      .returning({ id: teamInvite.id });

    if (written.length === 0) {
      throw new InviteMovedOnError(id);
    }
  }

  async find(id: InviteId): Promise<Invite | null> {
    const [found] = await this.context.db
      .select()
      .from(teamInvite)
      .where(eq(teamInvite.id, id.value))
      .limit(1);

    return found ? this.rehydrated(found) : null;
  }

  async withToken(hash: TokenHash): Promise<Invite | null> {
    const [found] = await this.context.db
      .select()
      .from(teamInvite)
      .where(eq(teamInvite.tokenHash, hash.value))
      .limit(1);

    return found ? this.rehydrated(found) : null;
  }

  async to(teamId: TeamId, email: EmailAddress): Promise<Invite | null> {
    const [found] = await this.context.db
      .select()
      .from(teamInvite)
      .where(
        and(
          eq(teamInvite.teamId, teamId.value),
          eq(teamInvite.email, email.value),
        ),
      )
      .orderBy(desc(teamInvite.invitedAt))
      .limit(1);

    return found ? this.rehydrated(found) : null;
  }

  private written(held: Invite) {
    return {
      id: held.id.value,
      teamId: held.teamId.value,
      workspaceId: held.workspaceId.value,
      email: held.email.value,
      tokenHash: held.tokenHash.value,
      invitedBy: held.invitedBy.value,
      invitedAt: held.invitedAt,
      expiresAt: held.expiresAt,
      acceptedAt: held.acceptedAt,
      acceptedBy: held.acceptedBy?.value ?? null,
      revokedAt: held.revokedAt,
    };
  }

  private rehydrated(row: Row): Invite {
    return Invite.rehydrate({
      id: InviteId.of(row.id),
      teamId: TeamId.of(row.teamId),
      workspaceId: WorkspaceId.of(row.workspaceId),
      email: EmailAddress.of(row.email),
      tokenHash: TokenHash.of(row.tokenHash),
      invitedBy: UserId.of(row.invitedBy),
      invitedAt: row.invitedAt,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      acceptedBy: row.acceptedBy ? UserId.of(row.acceptedBy) : null,
      revokedAt: row.revokedAt,
      version: row.version,
    });
  }
}
