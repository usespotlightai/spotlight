import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TeamStanding } from '@work/domain/value-objects/team-standing.vo';

export const ChatAccess = {
  opensTo(startedBy: UserId, viewer: UserId, standing: TeamStanding): boolean {
    return startedBy.equals(viewer) && standing.seesTasks;
  },
};
