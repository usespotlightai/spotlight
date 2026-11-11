import type { WorkspaceCreated } from '@identity/domain/events/workspace-created.event';
import type { WorkspaceMemberJoined } from '@identity/domain/events/workspace-member-joined.event';
import {
  type ChangeNoticeMapper,
  changedFor,
  noticing,
} from '@platform/live/change-notices';

export const IDENTITY_CHANGE_NOTICES: readonly ChangeNoticeMapper[] = [
  noticing<WorkspaceCreated>(
    'identity.workspace-created',
    ['workspace.created'],
    (event) =>
      changedFor(event.owner.value, 'workspaces', {
        workspaceId: event.workspaceId.value,
      }),
  ),
  noticing<WorkspaceMemberJoined>(
    'identity.member-joined',
    ['workspace.member-joined'],
    (event) =>
      changedFor(event.userId.value, 'workspaces', {
        workspaceId: event.workspaceId.value,
      }),
  ),
];
