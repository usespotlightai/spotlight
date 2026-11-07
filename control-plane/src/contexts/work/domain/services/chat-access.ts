import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const ChatAccess = {
  readableBy(startedBy: UserId, viewer: UserId): boolean {
    return startedBy.equals(viewer);
  },
};
