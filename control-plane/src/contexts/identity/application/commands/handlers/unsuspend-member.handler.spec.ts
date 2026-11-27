import { UnsuspendMemberHandler } from '@identity/application/commands/handlers/unsuspend-member.handler';
import type { UnsuspendMemberCommand } from '@identity/application/commands/unsuspend-member.command';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-20T10:00:00.000Z');

const acme = () =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: [
      {
        userId: UserId.of('user_owner'),
        role: WorkspaceRole.owner,
        suspendedAt: null,
      },
      {
        userId: UserId.of('user_admin'),
        role: WorkspaceRole.admin,
        suspendedAt: null,
      },
      {
        userId: UserId.of('user_ada'),
        role: WorkspaceRole.member,
        suspendedAt: NOW,
      },
    ],
    version: 3,
  });

const handling = (workspace: Workspace | null = acme()) => {
  const dispatched: DomainEvent[] = [];
  const save = vi.fn(async (saved: Workspace) => {
    dispatched.push(...saved.pullEvents());
  });
  const info = vi.fn();
  const handler = new UnsuspendMemberHandler(
    partial<WorkspaceRepository>({
      findBySlug: async () => workspace,
      save,
    }),
    { now: () => NOW, sleep: async () => {} },
    partial<LoggerPort>({ info }),
  );

  return { handler, save, dispatched, info };
};

const command = (
  over: Partial<UnsuspendMemberCommand> = {},
): UnsuspendMemberCommand => ({
  slug: 'acme',
  userId: 'user_ada',
  viewerId: 'user_admin',
  ...over,
});

describe('UnsuspendMemberHandler', () => {
  it('saves the workspace the rule returns, version and all', async () => {
    const { handler, save } = handling();

    await expect(handler.execute(command())).resolves.toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].version).toBe(3);
    expect(save.mock.calls[0]?.[0].isSuspended(UserId.of('user_ada'))).toBe(
      false,
    );
  });

  it('says so, and logs who did it to whom', async () => {
    const { handler, dispatched, info } = handling();

    await handler.execute(command());

    expect(dispatched).toMatchObject([
      { kind: 'workspace.member-unsuspended', at: NOW },
    ]);
    expect(info).toHaveBeenCalledWith(
      { workspaceId: 'ws_1', userId: 'user_ada', by: 'user_admin' },
      'member.unsuspended',
    );
  });

  it('saves nothing where the workspace denied it', async () => {
    const { handler, save } = handling();

    await expect(
      handler.execute(command({ userId: 'user_owner' })),
    ).rejects.toThrow(/Only an owner can suspend/);
    expect(save).not.toHaveBeenCalled();
  });

  it('is nothing to somebody outside the workspace', async () => {
    const { handler, save } = handling();

    await expect(
      handler.execute(command({ viewerId: 'stranger' })),
    ).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('is nothing where there is no such workspace', async () => {
    const { handler, save } = handling(null);

    await expect(handler.execute(command())).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });
});
