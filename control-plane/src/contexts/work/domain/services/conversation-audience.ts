import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const ConversationAudience = {
  includes(assignee: UserId | null, viewer: UserId): boolean {
    return assignee?.equals(viewer) ?? false;
  },

  assigneeShownTo(viewer: UserId): UserId {
    return viewer;
  },
};
