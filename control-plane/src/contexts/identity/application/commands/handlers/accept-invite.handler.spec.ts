import { AcceptInviteCommand } from '@identity/application/commands/accept-invite.command';
import { AcceptInviteHandler } from '@identity/application/commands/handlers/accept-invite.handler';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { InviteVersionConflictError } from '@identity/domain/exceptions/invite-version-conflict.error';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteSpec } from '@identity/domain/value-objects/invite-spec.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-13T09:00:00.000Z');

const workspace = Workspace.rehydrate({
  id: WorkspaceId.of('ws_1'),
  name: WorkspaceName.of('Acme'),
  slug: WorkspaceSlug.of('acme'),
  members: [{ userId: UserId.of('user_leon'), role: WorkspaceRole.owner }],
  version: 0,
});

const sentInvite = (over: { sentAt?: Date; revoked?: boolean } = {}) => {
  const created = WorkspaceInvite.create({
    id: InviteId.of('invite_1'),
    workspaceId: workspace.id,
    email: EmailAddress.of('Ada@Example.com'),
    spec: InviteSpec.of(WorkspaceRole.admin, [
      TeamId.of('team_1'),
      TeamId.of('team_2'),
    ]),
    tokenHash: TokenHash.of('a'.repeat(64)),
    invitedBy: UserId.of('user_leon'),
    now: over.sentAt ?? new Date('2026-09-12T09:00:00.000Z'),
  });

  const invite = over.revoked
    ? created.revoke(UserId.of('user_leon'), NOW)
    : created;

  invite.pullEvents();

  return invite;
};

const accepting = (invite: WorkspaceInvite | null = sentInvite()) => {
  const dispatched: DomainEvent[] = [];
  const save = vi.fn(async (saved: WorkspaceInvite) => {
    dispatched.push(...saved.pullEvents());
  });

  const handler = new AcceptInviteHandler(
    {
      withToken: async () => invite,
      save,
    } as unknown as WorkspaceInviteRepository,
    { find: async () => workspace } as unknown as WorkspaceRepository,
    { hash: () => 'a'.repeat(64) } as unknown as TokenIssuer,
    { now: () => NOW } as ClockPort,
  );

  return { handler, save, dispatched };
};

const accept = (email = 'ada@example.com') =>
  new AcceptInviteCommand('tok', 'user_ada', email);

describe('AcceptInviteHandler', () => {
  it('says which workspace they land in', async () => {
    const { handler } = accepting();

    await expect(handler.execute(accept())).resolves.toEqual({
      workspaceSlug: 'acme',
    });
  });

  it('marks the invite taken up, so the link is spent', async () => {
    const { handler, save } = accepting();

    await handler.execute(accept());

    expect(save.mock.calls[0]?.[0]).toMatchObject({
      acceptedAt: NOW,
      acceptedBy: { value: 'user_ada' },
    });
  });

  it('says the invite was accepted, with the role and teams for the workspace and teams to take them in', async () => {
    const { handler, dispatched } = accepting();

    await handler.execute(accept('ADA@example.com'));

    expect(dispatched).toMatchObject([
      {
        kind: 'workspace-invite.accepted',
        spec: {
          role: WorkspaceRole.admin,
          teams: [{ value: 'team_1' }, { value: 'team_2' }],
        },
      },
    ]);
  });

  it('is nothing to a link that points to no invite', async () => {
    const { handler, save } = accepting(null);

    await expect(handler.execute(accept())).resolves.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects somebody signed in as anybody but the person invited, naming who to sign in as', async () => {
    const { handler, save } = accepting();

    await expect(
      handler.execute(accept('grace@example.com')),
    ).rejects.toMatchObject({
      kind: 'not-allowed',
      message: expect.stringMatching(/sign in as ada@example.com/),
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an invite that has been taken back', async () => {
    const { handler, save } = accepting(sentInvite({ revoked: true }));

    await expect(handler.execute(accept())).rejects.toThrow(/been revoked/);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an invite that has run out', async () => {
    const { handler, save } = accepting(
      sentInvite({ sentAt: new Date('2026-08-01T09:00:00.000Z') }),
    );

    await expect(handler.execute(accept())).rejects.toThrow(/has expired/);
    expect(save).not.toHaveBeenCalled();
  });

  it('fails with a conflict where the invite was revoked while it was being accepted', async () => {
    const { handler, save, dispatched } = accepting();
    save.mockImplementationOnce(async () => {
      throw new InviteVersionConflictError('invite_1');
    });

    await expect(handler.execute(accept())).rejects.toMatchObject({
      kind: 'conflict',
    });
    expect(dispatched).toEqual([]);
  });
});
