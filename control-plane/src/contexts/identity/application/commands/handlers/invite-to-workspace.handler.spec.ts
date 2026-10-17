import { InviteToWorkspaceHandler } from '@identity/application/commands/handlers/invite-to-workspace.handler';
import { InviteToWorkspaceCommand } from '@identity/application/commands/invite-to-workspace.command';
import type {
  InviteMailPort,
  InviteToSend,
} from '@identity/application/ports/invite-mail.port';
import type { MemberDirectoryPort } from '@identity/application/ports/member-directory.port';
import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import { InviteSending } from '@identity/application/services/invite-sending.service';
import { WorkspaceAdministration } from '@identity/application/services/workspace-administration.service';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { AlreadyInvitedError } from '@identity/domain/exceptions/already-invited.error';
import { InviteVersionConflictError } from '@identity/domain/exceptions/invite-version-conflict.error';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteTerms } from '@identity/domain/value-objects/invite-terms.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-12T09:00:00.000Z');
const LEON = UserId.of('user_leon');
const ACME = WorkspaceId.of('ws_1');

const workspace = (role = WorkspaceRole.owner) =>
  Workspace.rehydrate({
    id: ACME,
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: role.isOwner
      ? [{ userId: LEON, role }]
      : [
          { userId: UserId.of('user_owner'), role: WorkspaceRole.owner },
          { userId: LEON, role },
        ],
    version: 0,
  });

const team = (id: string, name: string) =>
  Team.rehydrate({
    id: TeamId.of(id),
    workspaceId: ACME,
    key: TeamKey.of(name.toLowerCase()),
    name: TeamName.of(name),
    members: [LEON],
    version: 0,
  });

const TEAMS = [team('team_1', 'Platform'), team('team_2', 'Mobile')];

const kept = (invite: WorkspaceInvite): WorkspaceInvite =>
  WorkspaceInvite.rehydrate({ ...invite, version: invite.version + 1 });

const standing = (
  email = 'ada@example.com',
  sentAt = new Date('2026-09-01T09:00:00.000Z'),
) =>
  kept(
    WorkspaceInvite.offer({
      id: InviteId.of(`invite_${email}`),
      workspaceId: ACME,
      email: EmailAddress.of(email),
      terms: InviteTerms.of(WorkspaceRole.member, []),
      tokenHash: TokenHash.of('b'.repeat(64)),
      invitedBy: LEON,
      now: sentAt,
    }),
  );

const inviting = (
  over: {
    role?: WorkspaceRole;
    members?: readonly string[];
    previous?: (email: string) => WorkspaceInvite | null;
    add?: (added: WorkspaceInvite) => Promise<void>;
    save?: (saved: WorkspaceInvite) => Promise<void>;
    mail?: (sending: InviteToSend) => Promise<void>;
    sender?: null;
  } = {},
) => {
  const add = vi.fn(over.add ?? (async (_: WorkspaceInvite) => {}));
  const save = vi.fn(over.save ?? (async (_: WorkspaceInvite) => {}));
  const send = vi.fn(over.mail ?? (async (_: InviteToSend) => {}));
  const warn = vi.fn();
  let minted = 0;
  let generated = 0;

  const handler = new InviteToWorkspaceHandler(
    new WorkspaceAdministration({
      findBySlug: async () => workspace(over.role),
    } as unknown as WorkspaceRepository),
    {
      add,
      save,
      openTo: async (_: WorkspaceId, email: EmailAddress) =>
        over.previous?.(email.value) ?? null,
    } as unknown as WorkspaceInviteRepository,
    { ofWorkspace: async () => TEAMS } as unknown as TeamRepository,
    {
      byEmail: async (_: WorkspaceId, email: string) =>
        over.members?.includes(email) ? UserId.of('user_x') : null,
    } as MemberDirectoryPort,
    new InviteSending(
      {
        find: async () =>
          over.sender === null
            ? null
            : { id: 'user_leon', name: 'Leon', image: null },
      } as unknown as PersonReaderPort,
      { send } as InviteMailPort,
      { warn } as unknown as LoggerPort,
    ),
    {
      mint: () => {
        minted += 1;
        return { token: `tok_${minted}`, hash: `${minted}`.repeat(64) };
      },
    } as unknown as TokenMintPort,
    {
      generate: () => {
        generated += 1;
        return `invite_${generated}`;
      },
    } as IdGeneratorPort,
    { now: () => NOW } as ClockPort,
  );

  return { handler, add, save, send, warn };
};

const invite = (
  emails: string[],
  role = 'admin',
  teamIds = ['team_1', 'team_2'],
  viewer = 'user_leon',
) => new InviteToWorkspaceCommand('acme', emails, role, teamIds, viewer);

describe('InviteToWorkspaceHandler', () => {
  it('invites every address asked, as one invite each, with one email each', async () => {
    const { handler, add, send } = inviting();

    await expect(
      handler.execute(
        invite(['ada@example.com', 'grace@example.com', 'alan@example.com']),
      ),
    ).resolves.toEqual({
      outcomes: [
        { email: 'ada@example.com', outcome: 'invited' },
        { email: 'grace@example.com', outcome: 'invited' },
        { email: 'alan@example.com', outcome: 'invited' },
      ],
    });

    expect(add).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenCalledTimes(3);
    expect(add.mock.calls[0]?.[0].terms.invitedAs).toBe('admin');
    expect(
      add.mock.calls[0]?.[0].terms.teams.map((each) => each.value),
    ).toEqual(['team_1', 'team_2']);
    expect(send.mock.calls[0]?.[0]).toEqual({
      to: 'ada@example.com',
      token: 'tok_1',
      workspaceName: 'Acme',
      teamNames: ['Platform', 'Mobile'],
      invitedBy: 'Leon',
    });
  });

  it('keeps the invite whose email could not be sent, says so, and carries on with the rest', async () => {
    const { handler, add, send, warn } = inviting({
      mail: async (sending) => {
        if (sending.to === 'grace@example.com') {
          throw new Error('mailbox unavailable');
        }
      },
    });

    await expect(
      handler.execute(
        invite(['ada@example.com', 'grace@example.com', 'alan@example.com']),
      ),
    ).resolves.toEqual({
      outcomes: [
        { email: 'ada@example.com', outcome: 'invited' },
        { email: 'grace@example.com', outcome: 'not-sent' },
        { email: 'alan@example.com', outcome: 'invited' },
      ],
    });
    expect(add).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('is nothing when the person inviting can no longer be found', async () => {
    const { handler, add, send } = inviting({ sender: null });

    await expect(
      handler.execute(invite(['ada@example.com'])),
    ).resolves.toBeNull();
    expect(add).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps only the hash of the token it sent', async () => {
    const { handler, add } = inviting();

    await handler.execute(invite(['ada@example.com']));

    expect(add.mock.calls[0]?.[0].tokenHash.value).toBe('1'.repeat(64));
  });

  it('asks each address once, however it was written', async () => {
    const { handler, add } = inviting();

    const { outcomes } =
      (await handler.execute(
        invite(['Ada@Example.com', 'ada@example.com ']),
      )) ?? {};

    expect(outcomes).toEqual([
      { email: 'ada@example.com', outcome: 'invited' },
    ]);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('reports an address already in the workspace, and sends it nothing', async () => {
    const { handler, add, send } = inviting({ members: ['ada@example.com'] });

    await expect(
      handler.execute(invite(['ada@example.com', 'grace@example.com'])),
    ).resolves.toEqual({
      outcomes: [
        { email: 'ada@example.com', outcome: 'already-a-member' },
        { email: 'grace@example.com', outcome: 'invited' },
      ],
    });
    expect(add).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends an open invite again, on the terms asked now, rather than opening a second', async () => {
    const { handler, add, save, send } = inviting({
      previous: () => standing(),
    });

    await expect(handler.execute(invite(['ada@example.com']))).resolves.toEqual(
      {
        outcomes: [{ email: 'ada@example.com', outcome: 'sent-again' }],
      },
    );
    expect(add).not.toHaveBeenCalled();
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      id: { value: 'invite_ada@example.com' },
      invitedAt: NOW,
    });
    expect(save.mock.calls[0]?.[0].terms.invitedAs).toBe('admin');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends a run-out invite again', async () => {
    const { handler, save } = inviting({
      previous: () => standing('ada@example.com', new Date('2026-08-01')),
    });

    await handler.execute(invite(['ada@example.com']));

    expect(save.mock.calls[0]?.[0].statusAt(NOW)).toBe('open');
  });

  it('sends the invite another first offer just opened, where that offer wrote first, and carries on', async () => {
    const opened = new Map<string, WorkspaceInvite>();
    const { handler, add, save, send } = inviting({
      previous: (email) => opened.get(email) ?? null,
      add: async (added) => {
        if (added.email.value === 'ada@example.com') {
          opened.set('ada@example.com', standing());
          throw new AlreadyInvitedError(added.email.value);
        }
      },
    });

    await expect(
      handler.execute(invite(['ada@example.com', 'grace@example.com'])),
    ).resolves.toEqual({
      outcomes: [
        { email: 'ada@example.com', outcome: 'sent-again' },
        { email: 'grace@example.com', outcome: 'invited' },
      ],
    });
    expect(add).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0]?.[0].id.value).toBe('invite_ada@example.com');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('sends again from what the invite became, where another send wrote first', async () => {
    let saves = 0;
    const { handler, save, send } = inviting({
      previous: () => standing(),
      save: async (saved) => {
        saves += 1;
        if (saves === 1) {
          throw new InviteVersionConflictError(saved.id.value);
        }
      },
    });

    await handler.execute(invite(['ada@example.com']));

    expect(save).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('is nothing to somebody who may not invite to this workspace', async () => {
    const { handler, add, send } = inviting({ role: WorkspaceRole.member });

    await expect(
      handler.execute(invite(['ada@example.com'], 'member')),
    ).resolves.toBeNull();
    expect(add).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('lets an admin invite admins', async () => {
    const { handler, add } = inviting({ role: WorkspaceRole.admin });

    await handler.execute(invite(['ada@example.com'], 'admin'));

    expect(add).toHaveBeenCalledTimes(1);
  });

  it('refuses to invite an owner, and sends nothing', async () => {
    const { handler, add, send } = inviting();

    await expect(
      handler.execute(invite(['ada@example.com'], 'owner')),
    ).rejects.toMatchObject({ kind: 'not-allowed' });
    expect(add).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a team that is not in the workspace, and sends nothing', async () => {
    const { handler, send } = inviting();

    await expect(
      handler.execute(invite(['ada@example.com'], 'member', ['team_9'])),
    ).rejects.toThrow(/Team team_9 is not in this workspace/);
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses something that is not an address before sending anything', async () => {
    const { handler, send } = inviting();

    await expect(
      handler.execute(invite(['ada@example.com', 'grace'])),
    ).rejects.toThrow(/Email address is not valid/);
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses to invite nobody', async () => {
    const { handler } = inviting();

    await expect(handler.execute(invite([]))).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('may invite onto no team at all', async () => {
    const { handler, send } = inviting();

    await handler.execute(invite(['ada@example.com'], 'member', []));

    expect(send.mock.calls[0]?.[0].teamNames).toEqual([]);
  });
});
