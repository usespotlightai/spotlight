import { InviteToTeamHandler } from '@identity/application/commands/handlers/invite-to-team.handler';
import type { InviteToTeamCommand } from '@identity/application/commands/invite-to-team.command';
import type {
  InviteMailPort,
  InviteToSend,
} from '@identity/application/ports/invite-mail.port';
import type { MemberReaderPort } from '@identity/application/ports/member-reader.port';
import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { TeamAdministration } from '@identity/application/services/team-administration.service';
import { Invite } from '@identity/domain/aggregates/invite.aggregate';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { InviteMovedOnError } from '@identity/domain/exceptions/invite-moved-on.error';
import type { InviteRepository } from '@identity/domain/repositories/invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-12T09:00:00.000Z');

const workspace = Workspace.rehydrate({
  id: WorkspaceId.of('ws_1'),
  name: WorkspaceName.of('Acme'),
  slug: WorkspaceSlug.of('acme'),
  members: [{ userId: UserId.of('user_leon'), role: WorkspaceRole.owner }],
  version: 0,
});

const team = Team.rehydrate({
  id: TeamId.of('team_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  key: TeamKey.of('platform'),
  name: TeamName.of('Platform'),
  members: [UserId.of('user_leon')],
  version: 0,
});

const kept = (invite: Invite): Invite =>
  Invite.rehydrate({ ...invite, version: invite.version + 1 });

const standing = (sentAt = new Date('2026-09-01T09:00:00.000Z')) =>
  kept(
    Invite.offer({
      id: InviteId.of('invite_1'),
      workspaceId: team.workspaceId,
      teamId: team.id,
      email: EmailAddress.of('ada@example.com'),
      tokenHash: TokenHash.of('b'.repeat(64)),
      invitedBy: UserId.of('user_leon'),
      now: sentAt,
    }),
  );

const inviting = (
  over: {
    allowed?: boolean;
    onTeam?: boolean;
    previous?: Invite | null;
    freshId?: string;
    save?: (saved: Invite) => Promise<void>;
    previousEachTime?: () => Invite | null;
  } = {},
) => {
  const add = vi.fn(async (_: Invite) => {});
  const save = vi.fn(over.save ?? (async (_: Invite) => {}));
  const send = vi.fn(async (_: InviteToSend) => {});

  const handler = new InviteToTeamHandler(
    {
      administeredBy: async () =>
        over.allowed === false
          ? null
          : { team, workspace, by: UserId.of('user_leon') },
    } as unknown as TeamAdministration,
    {
      add,
      save,
      to: async () => over.previousEachTime?.() ?? over.previous ?? null,
    } as unknown as InviteRepository,
    { onTeam: async () => over.onTeam ?? false } as unknown as MemberReaderPort,
    {
      find: async () => ({ id: 'user_leon', name: 'Leon Liang', image: null }),
      findMany: async () => new Map(),
    } as PersonReaderPort,
    {
      mint: () => ({ token: 'tok', hash: 'a'.repeat(64) }),
      hash: () => 'a'.repeat(64),
    } as TokenMintPort,
    { send } as InviteMailPort,
    { generate: () => over.freshId ?? 'invite_1' } as IdGeneratorPort,
    { now: () => NOW } as ClockPort,
  );

  return { handler, add, save, send };
};

const invite = (email = 'Ada@Example.com') =>
  ({ teamId: 'team_1', email, viewerId: 'user_leon' }) as InviteToTeamCommand;

describe('InviteToTeamHandler', () => {
  it('writes the invite down and sends the link', async () => {
    const { handler, add, send } = inviting();

    await expect(handler.execute(invite())).resolves.toMatchObject({
      id: 'invite_1',
      email: 'ada@example.com',
      invitedBy: 'Leon Liang',
    });

    expect(add).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      to: 'ada@example.com',
      token: 'tok',
      teamName: 'Platform',
      workspaceName: 'Acme',
      invitedBy: 'Leon Liang',
    });
  });

  it('keeps only the hash of the token it sent', async () => {
    const { handler, add } = inviting();

    await handler.execute(invite());

    expect(add.mock.calls[0]?.[0]).toMatchObject({
      tokenHash: { value: 'a'.repeat(64) },
    });
  });

  it('is nothing to somebody who may not invite to this team', async () => {
    const { handler, add, send } = inviting({ allowed: false });

    await expect(handler.execute(invite())).resolves.toBeNull();
    expect(add).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses somebody already on the team', async () => {
    const { handler, send } = inviting({ onTeam: true });

    await expect(handler.execute(invite())).rejects.toThrow(
      /already on this team/,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses something that is not an address', async () => {
    const { handler, send } = inviting();

    await expect(handler.execute(invite('ada'))).rejects.toThrow(
      /not an email address/,
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the open invite again rather than opening a second', async () => {
    const previous = standing();
    const { handler, add, save, send } = inviting({ previous });

    await handler.execute(invite());

    expect(add).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      id: { value: 'invite_1' },
      tokenHash: { value: 'a'.repeat(64) },
      invitedAt: NOW,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ada@example.com', token: 'tok' }),
    );
  });

  it('opens a fresh invite where the last one was revoked', async () => {
    const previous = kept(
      standing().revoked(new Date('2026-09-02T09:00:00.000Z')),
    );
    const { handler, add, save } = inviting({
      previous,
      freshId: 'invite_2',
    });

    await handler.execute(invite());

    expect(save).not.toHaveBeenCalled();
    expect(add.mock.calls[0]?.[0]).toMatchObject({ id: { value: 'invite_2' } });
  });

  it('refuses to send again an invite already taken up', async () => {
    const previous = kept(
      standing(new Date('2026-09-10T09:00:00.000Z')).acceptedBySomeone(
        UserId.of('user_ada'),
        EmailAddress.of('ada@example.com'),
        new Date('2026-09-11T09:00:00.000Z'),
      ),
    );
    const { handler, add, save, send } = inviting({ previous });

    await expect(handler.execute(invite())).rejects.toThrow(
      /already been accepted/,
    );
    expect(add).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends again from what the invite became, where another send wrote first', async () => {
    const readings = [standing(), kept(standing())];
    let saves = 0;
    const { handler, save, send } = inviting({
      previousEachTime: () => readings.shift() ?? null,
      save: async (saved) => {
        saves += 1;
        if (saves === 1) {
          throw new InviteMovedOnError(saved.id.value);
        }
      },
    });

    await handler.execute(invite());

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0]).toMatchObject({ version: 2 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('gives up with a conflict, and sends nothing, where the invite keeps moving', async () => {
    const { handler, send } = inviting({
      previous: standing(),
      save: async (saved) => {
        throw new InviteMovedOnError(saved.id.value);
      },
    });

    await expect(handler.execute(invite())).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('will not reopen an invite that was accepted while it was being sent again', async () => {
    const readings = [
      standing(),
      kept(
        standing().acceptedBySomeone(
          UserId.of('user_ada'),
          EmailAddress.of('ada@example.com'),
          new Date('2026-09-02T09:00:00.000Z'),
        ),
      ),
    ];
    const { handler, save, send } = inviting({
      previousEachTime: () => readings.shift() ?? null,
      save: async (saved) => {
        throw new InviteMovedOnError(saved.id.value);
      },
    });

    await expect(handler.execute(invite())).rejects.toThrow(
      /already been accepted/,
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });
});
