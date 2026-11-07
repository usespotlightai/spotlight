import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  SeenTeam,
  WorkAccess,
} from '@work/application/services/work-access.service';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';

export const workAccessSeeing = (
  sees: (teamId: TeamId, viewer: UserId) => boolean,
  over: {
    readonly members?: readonly UserId[];
    readonly admin?: boolean;
    readonly onTeam?: (teamId: TeamId, viewer: UserId) => boolean;
  } = {},
): WorkAccess => {
  const readsTeam = (teamId: TeamId, viewer: UserId): boolean =>
    sees(teamId, viewer) && (over.onTeam?.(teamId, viewer) ?? true);

  const seenTeam = async (
    teamId: TeamId,
    viewer: UserId,
  ): Promise<SeenTeam | null> =>
    sees(teamId, viewer)
      ? {
          workspaceId: WorkspaceId.of('ws_1'),
          teamId,
          teamKey: 'platform',
          slug: 'acme',
          origin: 'configuration',
        }
      : null;

  return {
    seenTeam,
    seesTeam: async (teamId: TeamId, viewer: UserId) =>
      (await seenTeam(teamId, viewer)) !== null,
    readsTeam: async (teamId: TeamId, viewer: UserId) =>
      readsTeam(teamId, viewer),
    standingOn: async (teamId: TeamId, viewer: UserId) =>
      TeamStanding.of({
        seesTeam: sees(teamId, viewer),
        readsTeam: readsTeam(teamId, viewer),
      }),
    isAdminOf: async () => over.admin ?? false,
    membersOf: async () => TeamMembers.of(over.members ?? []),
    inboxOf: async () => null,
  } as unknown as WorkAccess;
};
