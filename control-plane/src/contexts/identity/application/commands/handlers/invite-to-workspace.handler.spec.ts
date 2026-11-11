import { InviteToWorkspaceHandler } from '@identity/application/commands/handlers/invite-to-workspace.handler';
import { InviteToWorkspaceCommand } from '@identity/application/commands/invite-to-workspace.command';
import type { InviteToSend } from '@identity/application/ports/invite-mail.port';
import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import { InviteSending } from '@identity/application/services/invite-sending.service';
import { WorkspaceAdministration } from '@identity/application/services/workspace-administration.service';
import { WorkspaceInviting } from '@identity/application/services/workspace-inviting.service';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { AlreadyInvitedError } from '@identity/domain/exceptions/already-invited.error';
import { InviteVersionConflictError } from '@identity/domain/exceptions/invite-version-conflict.error';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteSpec } from '@identity/domain/value-objects/invite-spec.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
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
    origin: 'configuration',
    members: [LEON],
    version: 0,
  });

const TEAMS = [team('team_1', 'Platform'), team('team_2', 'Mobile')];

const stored = (invite: WorkspaceInvite): WorkspaceInvite =>
  WorkspaceInvite.rehydrate({ ...invite, version: invite.version + 1 });

const pendingInvite = (
  email = 'ada@example.com',
  sentAt = new Date('2026-09-01T09:00:00.000Z'),
) =>
  stored(
    WorkspaceInvite.create({
      id: InviteId.of(`invite_${email}`),
      workspaceId: ACME,
      email: EmailAddress.of(email),
      spec: InviteSpec.of(WorkspaceRole.member, []),
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
  const add = vi.fn<(invite: WorkspaceInvite) => Promise<void>>(
    over.add ?? (async () => {}),
  );
  const save = vi.fn<(invite: WorkspaceInvite) => Promise<void>>(
    over.save ?? (async () => {}),
  );
  const send = vi.fn<(sending: InviteToSend) => Promise<void>>(
    over.mail ?? (async () => {}),
  );
  const warn = vi.fn();
  let issued = 0;
  let generated = 0;

  const administration = new WorkspaceAdministration({
    findBySlug: async () => workspace(over.role),
  } as unknown as WorkspaceRepository);
  const handler = new InviteToWorkspaceHandler(
    administration,
    {
      add,
      save,
      latestTo: async (_: WorkspaceId, email: EmailAddress) =>
        over.previous?.(email.value) ?? null,
    } as unknown as WorkspaceInviteRepository,
    { ofWorkspace: async () => TEAMS } as unknown as TeamRepository,
    {
      byEmail: async (_: WorkspaceId, email: string) =>
        over.members?.includes(email) ? LEON : null,
    },
    new InviteSending(
      {
        find: async () =>
          over.sender === null ? null : { id: LEON, name: 'Leon', image: null },
      } as unknown as PersonReaderPort,
      { send },
      { warn } as unknown as LoggerPort,
    ),
    {
      issue: () => {
        issued += 1;
        return { token: `tok_${issued}`, hash: `${issued}`.repeat(64) };
      },
    } as unknown as TokenIssuer,
    {
      generate: () => {
        generated += 1;
        return `invite_${generated}`;
      },
    },
    { now: () => NOW } as ClockPort,
  );

  const execute = vi.spyOn(handler, 'execute');
  const batch = new WorkspaceInviting(administration, handler);

  return { batch, handler, execute, add, save, send, warn };
};

const invite = (
  emails: string[],
  role = 'admin',
  teamIds = ['team_1', 'team_2'],
  viewer = 'user_leon',
) => ({ emails, role, teamIds, viewer });

const asked = async (
  batch: WorkspaceInviting,
  request: ReturnType<typeof invite>,
) => {
  const outcomes = await batch.invite({
    slug: 'acme',
    emails: request.emails,
    role: request.role,
    teamIds: request.teamIds,
    viewerId: request.viewer,
  });

  return outcomes ? { outcomes } : null;
};

describe('InviteToWorkspaceHandler', () => {
  it('invites the one address of its command, into one invite', async () => {
    const { handler, add, send } = inviting();

    await expect(
      handler.execute(
        new InviteToWorkspaceCommand(
          'acme',
          'Ada@Example.com',
          'member',
          [],
          'user_leon',
        ),
      ),
    ).resolves.toEqual({ email: 'ada@example.com', outcome: 'invited' });
    expect(add).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('WorkspaceInviting', () => {
  it('sends one command per address, after checking the list once', async () => {
    const { batch, execute } = inviting();

    await asked(batch, invite(['ada@example.com', 'grace@example.com']));

    expect(execute.mock.calls.map(([command]) => command.email)).toEqual([
      'ada@example.com',
      'grace@example.com',
    ]);
  });

  it('sends no command to somebody who may not invite to this workspace', async () => {
    const { batch, execute } = inviting({ role: WorkspaceRole.member });

    await expect(
      asked(batch, invite(['ada@example.com'], 'member')),
    ).resolves.toBeNull();
    expect(execute).not.toHaveBeenCalled();
  });

  it('invites every address in the request, one command and one invite each, with one email each', async () => {
    const { batch, add, send } = inviting();

    await expect(
      asked(
        batch,
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
    expect(add.mock.calls[0]?.[0].spec.invitedAs).toBe('admin');
    expect(add.mock.calls[0]?.[0].spec.teams.map((each) => each.value)).toEqual(
      ['team_1', 'team_2'],
    );
    expect(send.mock.calls[0]?.[0]).toEqual({
      to: 'ada@example.com',
      token: 'tok_1',
      workspaceName: 'Acme',
      teamNames: ['Platform', 'Mobile'],
      invitedBy: 'Leon',
    });
  });

  it('stores the invite whose email could not be sent, says so, and carries on with the rest', async () => {
    const { batch, add, send, warn } = inviting({
      mail: async (sending) => {
        if (sending.to === 'grace@example.com') {
          throw new Error('mailbox unavailable');
        }
      },
    });

    await expect(
      asked(
        batch,
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
    const { batch, add, send } = inviting({ sender: null });

    await expect(asked(batch, invite(['ada@example.com']))).resolves.toBeNull();
    expect(add).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('stores only the hash of the token it sent', async () => {
    const { batch, add } = inviting();

    await asked(batch, invite(['ada@example.com']));

    expect(add.mock.calls[0]?.[0].tokenHash.value).toBe('1'.repeat(64));
  });

  it('invites each address once, however it was written', async () => {
    const { batch, add } = inviting();

    const { outcomes } =
      (await asked(batch, invite(['Ada@Example.com', 'ada@example.com ']))) ??
      {};

    expect(outcomes).toEqual([
      { email: 'ada@example.com', outcome: 'invited' },
    ]);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('reports an address already in the workspace, and sends it nothing', async () => {
    const { batch, add, send } = inviting({ members: ['ada@example.com'] });

    await expect(
      asked(batch, invite(['ada@example.com', 'grace@example.com'])),
    ).resolves.toEqual({
      outcomes: [
        { email: 'ada@example.com', outcome: 'already-a-member' },
        { email: 'grace@example.com', outcome: 'invited' },
      ],
    });
    expect(add).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('resends a pending invite, with the settings requested now, rather than creating a second', async () => {
    const { batch, add, save, send } = inviting({
      previous: () => pendingInvite(),
    });

    await expect(asked(batch, invite(['ada@example.com']))).resolves.toEqual({
      outcomes: [{ email: 'ada@example.com', outcome: 'resent' }],
    });
    expect(add).not.toHaveBeenCalled();
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      id: { value: 'invite_ada@example.com' },
      invitedAt: NOW,
    });
    expect(save.mock.calls[0]?.[0].spec.invitedAs).toBe('admin');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('resends a run-out invite', async () => {
    const { batch, save } = inviting({
      previous: () => pendingInvite('ada@example.com', new Date('2026-08-01')),
    });

    await asked(batch, invite(['ada@example.com']));

    expect(save.mock.calls[0]?.[0].statusAt(NOW)).toBe('pending');
  });

  it('resends the invite that another first send just created, where that send wrote first, and carries on', async () => {
    const created = new Map<string, WorkspaceInvite>();
    const { batch, add, save, send } = inviting({
      previous: (email) => created.get(email) ?? null,
      add: async (added) => {
        if (added.email.value === 'ada@example.com') {
          created.set('ada@example.com', pendingInvite());
          throw new AlreadyInvitedError(added.email.value);
        }
      },
    });

    await expect(
      asked(batch, invite(['ada@example.com', 'grace@example.com'])),
    ).resolves.toEqual({
      outcomes: [
        { email: 'ada@example.com', outcome: 'resent' },
        { email: 'grace@example.com', outcome: 'invited' },
      ],
    });
    expect(add).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0]?.[0].id.value).toBe('invite_ada@example.com');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('resends from what the invite became, where another send wrote first', async () => {
    let saves = 0;
    const { batch, save, send } = inviting({
      previous: () => pendingInvite(),
      save: async (saved) => {
        saves += 1;
        if (saves === 1) {
          throw new InviteVersionConflictError(saved.id.value);
        }
      },
    });

    await asked(batch, invite(['ada@example.com']));

    expect(save).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('is nothing to somebody who may not invite to this workspace', async () => {
    const { batch, add, send } = inviting({ role: WorkspaceRole.member });

    await expect(
      asked(batch, invite(['ada@example.com'], 'member')),
    ).resolves.toBeNull();
    expect(add).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('lets an admin invite admins', async () => {
    const { batch, add } = inviting({ role: WorkspaceRole.admin });

    await asked(batch, invite(['ada@example.com'], 'admin'));

    expect(add).toHaveBeenCalledTimes(1);
  });

  it('does not invite an owner, and sends nothing', async () => {
    const { batch, add, send } = inviting();

    await expect(
      asked(batch, invite(['ada@example.com'], 'owner')),
    ).rejects.toMatchObject({ kind: 'not-allowed' });
    expect(add).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects a team that is not in the workspace, and sends nothing', async () => {
    const { batch, send } = inviting();

    await expect(
      asked(batch, invite(['ada@example.com'], 'member', ['team_9'])),
    ).rejects.toThrow(/Team team_9 is not in this workspace/);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects something that is not an address before sending anything', async () => {
    const { batch, send } = inviting();

    await expect(
      asked(batch, invite(['ada@example.com', 'grace'])),
    ).rejects.toThrow(/Email address is not valid/);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects an invite to nobody', async () => {
    const { batch } = inviting();

    await expect(asked(batch, invite([]))).rejects.toMatchObject({
      kind: 'invalid',
    });
  });

  it('may invite onto no team at all', async () => {
    const { batch, send } = inviting();

    await asked(batch, invite(['ada@example.com'], 'member', []));

    expect(send.mock.calls[0]?.[0].teamNames).toEqual([]);
  });
});
