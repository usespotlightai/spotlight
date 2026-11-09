import { WorkspaceMemberJoined } from '@identity/domain/events/workspace-member-joined.event';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { IDENTITY_CHANGE_NOTICES } from '@identity/presentation/live/identity.change-notices';
import { ChangeNotices } from '@platform/live/change-notices';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

describe('Identity change notices', () => {
  it('tells only the person who joined a workspace, so their stream can watch it', () => {
    const notices = new ChangeNotices();
    notices.register(IDENTITY_CHANGE_NOTICES);

    expect(
      notices.of(
        [
          new WorkspaceMemberJoined(
            WorkspaceId.of('ws_2'),
            UserId.of('user_1'),
            WorkspaceRole.of('member'),
          ),
        ],
        (name, error) => {
          throw new Error(`${name} failed: ${String(error)}`);
        },
      ),
    ).toEqual([
      {
        channel: 'person:user_1',
        topic: 'workspaces',
        ids: { workspaceId: 'ws_2' },
      },
    ]);
  });
});
