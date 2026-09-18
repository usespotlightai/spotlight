import { Invite } from '@identity/domain/aggregates/invite.aggregate';
import { InviteMovedOnError } from '@identity/domain/exceptions/invite-moved-on.error';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { DrizzleInviteRepository } from '@identity/infrastructure/persistence/drizzle/repositories/invite.repository';
import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

const SENT = new Date('2026-09-12T09:00:00.000Z');
const NOW = new Date('2026-09-13T09:00:00.000Z');

type Row = Record<string, unknown> & { id: string; version: number };

const dialect = new PgDialect();

const keeping = () => {
  const rows = new Map<string, Row>();
  const recorded: DomainEvent[] = [];

  const db = {
    insert: () => ({
      values: async (written: Row) => {
        rows.set(written.id, { ...written, version: 1 });
      },
    }),
    update: () => ({
      set: (written: Partial<Row>) => ({
        where: (condition: SQL) => ({
          returning: async () => {
            const [id, version] = dialect.sqlToQuery(condition).params;
            const row = rows.get(id as string);

            if (!row || row.version !== version) {
              return [];
            }

            rows.set(row.id, { ...row, ...written });

            return [{ id: row.id }];
          },
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: (condition: SQL) => ({
          limit: async () => {
            const [id] = dialect.sqlToQuery(condition).params;
            const row = rows.get(id as string);

            return row ? [row] : [];
          },
        }),
      }),
    }),
  };

  const context = {
    db,
    run: <T>(work: () => Promise<T>) => work(),
  } as unknown as DrizzleContext;

  const events: DomainEventDispatcher = {
    dispatch: async (dispatched) => {
      recorded.push(...dispatched);
    },
  };

  return {
    invites: new DrizzleInviteRepository(context, events),
    recorded,
  };
};

const offered = () =>
  Invite.offer({
    id: InviteId.of('invite_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    email: EmailAddress.of('ada@example.com'),
    tokenHash: TokenHash.of('a'.repeat(64)),
    invitedBy: UserId.of('user_leon'),
    now: SENT,
  });

const standing = async () => {
  const kept = keeping();
  await kept.invites.add(offered());
  kept.recorded.length = 0;

  const read = async () =>
    (await kept.invites.find(InviteId.of('invite_1'))) as Invite;

  return { ...kept, read };
};

const accepting = (invite: Invite) =>
  invite.acceptedBySomeone(
    UserId.of('user_ada'),
    EmailAddress.of('ada@example.com'),
    NOW,
  );

describe('DrizzleInviteRepository', () => {
  it('keeps a fresh invite at its first version', async () => {
    const { read } = await standing();

    expect((await read()).version).toBe(1);
  });

  it('refuses a revoke read before the invite was accepted, and records nothing for it', async () => {
    const { invites, read, recorded } = await standing();
    const acceptor = await read();
    const revoker = await read();

    await invites.save(accepting(acceptor));

    await expect(invites.save(revoker.revoked(NOW))).rejects.toThrow(
      InviteMovedOnError,
    );
    expect((await read()).acceptedAt).toEqual(NOW);
    expect(recorded.map((each) => each.kind)).toEqual(['invite.accepted']);
  });

  it('refuses an accept read before the invite was revoked, and records nothing for it', async () => {
    const { invites, read, recorded } = await standing();
    const acceptor = await read();
    const revoker = await read();

    await invites.save(revoker.revoked(NOW));

    await expect(invites.save(accepting(acceptor))).rejects.toThrow(
      InviteMovedOnError,
    );
    expect((await read()).revokedAt).toEqual(NOW);
    expect(recorded.map((each) => each.kind)).toEqual(['invite.revoked']);
  });

  it('refuses a send again that would reopen an invite accepted since it was read', async () => {
    const { invites, read } = await standing();
    const sender = await read();

    await invites.save(accepting(await read()));

    await expect(
      invites.save(
        sender.sentAgain({
          freshId: InviteId.of('invite_2'),
          tokenHash: TokenHash.of('b'.repeat(64)),
          by: UserId.of('user_leon'),
          now: NOW,
        }),
      ),
    ).rejects.toThrow(InviteMovedOnError);
    expect((await read()).acceptedAt).toEqual(NOW);
  });

  it('moves the version on with every write', async () => {
    const { invites, read } = await standing();

    await invites.save(accepting(await read()));

    expect((await read()).version).toBe(2);
  });
});
