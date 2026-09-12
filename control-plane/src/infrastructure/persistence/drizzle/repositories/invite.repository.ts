import { Invite } from '@domain/aggregates/invite.aggregate';
import { AlreadyInvitedError } from '@domain/exceptions/already-invited.error';
import type { InviteRepository } from '@domain/repositories/invite.repository';
import { EmailAddress } from '@domain/value-objects/email-address.vo';
import { InviteId } from '@domain/value-objects/invite-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TeamRole } from '@domain/value-objects/team-role.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { teamInvite } from '@infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

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
  readonly role: string;
  readonly tokenHash: string;
  readonly invitedBy: string;
  readonly invitedAt: Date;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly acceptedBy: string | null;
  readonly revokedAt: Date | null;
}

@Injectable()
export class DrizzleInviteRepository implements InviteRepository {
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Invite): Promise<void> {
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
    const { id, teamId, workspaceId, email, ...rest } = this.written(saved);

    await this.context.db
      .update(teamInvite)
      .set(rest)
      .where(eq(teamInvite.id, id));
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
      .limit(1);

    return found ? this.rehydrated(found) : null;
  }

  private written(held: Invite) {
    return {
      id: held.id.value,
      teamId: held.teamId.value,
      workspaceId: held.workspaceId.value,
      email: held.email.value,
      role: held.role.value,
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
      role: TeamRole.of(row.role),
      tokenHash: TokenHash.of(row.tokenHash),
      invitedBy: UserId.of(row.invitedBy),
      invitedAt: row.invitedAt,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      acceptedBy: row.acceptedBy ? UserId.of(row.acceptedBy) : null,
      revokedAt: row.revokedAt,
    });
  }
}
