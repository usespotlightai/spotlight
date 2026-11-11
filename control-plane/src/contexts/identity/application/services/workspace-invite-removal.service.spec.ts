import { WorkspaceInviteRemoval } from '@identity/application/services/workspace-invite-removal.service';
import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { WorkspaceDeleted } from '@identity/domain/events/workspace-deleted.event';
import { InviteVersionConflictError } from '@identity/domain/exceptions/invite-version-conflict.error';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteSpec } from '@identity/domain/value-objects/invite-spec.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { changeActorIn } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ACME = WorkspaceId.of('ws_1');

const invite = (id: string) =>
  WorkspaceInvite.rehydrate({
    id: InviteId.of(id),
    workspaceId: ACME,
    email: EmailAddress.of(`${id}@example.com`),
    spec: InviteSpec.of(WorkspaceRole.member, []),
    tokenHash: TokenHash.of((id === 'first' ? 'a' : 'b').repeat(64)),
    invitedBy: UserId.of('user_leon'),
    invitedAt: new Date('2026-11-01T09:00:00.000Z'),
    expiresAt: new Date('2026-11-15T09:00:00.000Z'),
    acceptedAt: null,
    acceptedBy: null,
    revokedAt: null,
    version: 2,
  });

const deleted = new WorkspaceDeleted(
  ACME,
  WorkspaceSlug.of('acme'),
  ConfigurationChange.deleted(
    { resource: 'workspace', id: 'ws_1', key: 'acme' },
    changeActorIn(ACME),
  ),
);

describe('WorkspaceInviteRemoval', () => {
  it('removes each invite of a deleted workspace on its own, at the version it was read', async () => {
    const remove = vi.fn(async (removed: WorkspaceInvite) => {
      if (removed.id.value === 'first') {
        throw new InviteVersionConflictError(removed.id.value);
      }
    });

    await new WorkspaceInviteRemoval({
      ofWorkspace: async () => [invite('first'), invite('second')],
      remove,
    } as unknown as WorkspaceInviteRepository).removeOf(deleted);

    expect(remove.mock.calls.map(([each]) => each.id.value)).toEqual([
      'first',
      'second',
    ]);
    expect(remove.mock.calls[1]?.[0].version).toBe(2);
  });

  it('removes no invite of another workspace', () => {
    expect(() =>
      invite('first').removedWithWorkspace(WorkspaceId.of('ws_2')),
    ).toThrow(/does not belong to/);
  });
});
