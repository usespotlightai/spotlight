import type { ChangeMemberRoleCommand } from '@identity/application/commands/change-member-role.command';
import { ChangeMemberRoleHandler } from '@identity/application/commands/handlers/change-member-role.handler';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const acme = (...members: readonly [string, WorkspaceRole][]) =>
  Workspace.rehydrate({
    id: WorkspaceId.of('ws_1'),
    name: WorkspaceName.of('Acme'),
    slug: WorkspaceSlug.of('acme'),
    members: members.map(([id, role]) => ({ userId: UserId.of(id), role })),
    version: 3,
  });

const staffed = () =>
  acme(
    ['user_owner', WorkspaceRole.owner],
    ['user_admin', WorkspaceRole.admin],
    ['user_ada', WorkspaceRole.member],
  );

const changing = (workspace: Workspace | null = staffed()) => {
  const dispatched: DomainEvent[] = [];
  const save = vi.fn(async (saved: Workspace) => {
    dispatched.push(...saved.pullEvents());
  });

  const handler = new ChangeMemberRoleHandler({
    findBySlug: async () => workspace,
    save,
  } as unknown as WorkspaceRepository);

  return { handler, save, dispatched };
};

const change = (
  over: Partial<ChangeMemberRoleCommand> = {},
): ChangeMemberRoleCommand =>
  ({
    slug: 'acme',
    userId: 'user_ada',
    role: 'admin',
    viewerId: 'user_owner',
    ...over,
  }) as ChangeMemberRoleCommand;

describe('ChangeMemberRoleHandler', () => {
  it('saves the workspace the rule returns', async () => {
    const { handler, save } = changing();

    await expect(handler.execute(change())).resolves.toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].roleOf(UserId.of('user_ada'))).toBe(
      WorkspaceRole.admin,
    );
  });

  it('writes the workspace it read, version and all', async () => {
    const { handler, save } = changing();

    await handler.execute(change());

    expect(save.mock.calls[0]?.[0].version).toBe(3);
  });

  it('says so, for whoever keeps a trail of who may do what', async () => {
    const { handler, dispatched } = changing();

    await handler.execute(change());

    expect(dispatched).toMatchObject([
      {
        kind: 'workspace.member-role-changed',
        was: WorkspaceRole.member,
        now: WorkspaceRole.admin,
      },
    ]);
  });

  it('reads a role however it was typed', async () => {
    const { handler, save } = changing();

    await handler.execute(change({ role: '  Admin ' }));

    expect(save.mock.calls[0]?.[0].roleOf(UserId.of('user_ada'))).toBe(
      WorkspaceRole.admin,
    );
  });

  it('rejects a role that is not one', async () => {
    const { handler, save } = changing();

    await expect(handler.execute(change({ role: 'wizard' }))).rejects.toThrow(
      /Role wizard does not exist/,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('saves nothing where the workspace denied the change', async () => {
    const { handler, save } = changing();

    await expect(
      handler.execute(change({ role: 'owner', viewerId: 'user_admin' })),
    ).rejects.toThrow(/cannot assign a role above your own/);
    expect(save).not.toHaveBeenCalled();
  });

  it('saves nothing where it would leave nobody who owns it', async () => {
    const { handler, save } = changing();

    await expect(
      handler.execute(change({ userId: 'user_owner', role: 'admin' })),
    ).rejects.toThrow(/needs at least one owner/);
    expect(save).not.toHaveBeenCalled();
  });

  it('is nothing to somebody outside the workspace', async () => {
    const { handler, save } = changing();

    await expect(
      handler.execute(change({ viewerId: 'stranger' })),
    ).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('is nothing where there is no such workspace', async () => {
    const { handler, save } = changing(null);

    await expect(handler.execute(change())).resolves.toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('takes a role somebody already has for an answer', async () => {
    const { handler, dispatched } = changing();

    await expect(
      handler.execute(change({ userId: 'user_admin', role: 'admin' })),
    ).resolves.toBe(true);
    expect(dispatched).toEqual([]);
  });
});
