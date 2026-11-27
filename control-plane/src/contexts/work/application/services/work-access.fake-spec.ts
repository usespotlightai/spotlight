import { partial } from '@shared-kernel/domain/partial.fake-spec';
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
  const actsOnTeam = (teamId: TeamId, viewer: UserId): boolean =>
    sees(teamId, viewer) && (over.onTeam?.(teamId, viewer) ?? true);

  const seenTeam = (teamId: TeamId, viewer: UserId): Promise<SeenTeam | null> =>
    Promise.resolve(
      sees(teamId, viewer)
        ? {
            workspaceId: WorkspaceId.of('ws_1'),
            teamId,
            teamKey: 'platform',
            slug: 'acme',
            origin: 'configuration',
          }
        : null,
    );

  return partial<WorkAccess>({
    seenTeam,
    seesTeam: async (teamId: TeamId, viewer: UserId) =>
      (await seenTeam(teamId, viewer)) !== null,
    standingOn: (teamId: TeamId, viewer: UserId) =>
      Promise.resolve(
        TeamStanding.of({
          seesTeam: sees(teamId, viewer),
          actsOnTeam: actsOnTeam(teamId, viewer),
          memberOfTeam:
            actsOnTeam(teamId, viewer) &&
            (over.members ?? []).some((each) => each.equals(viewer)),
        }),
      ),
    seesWorkspace: () => Promise.resolve(true),
    seesWorkspaceOfTeam: () => Promise.resolve(true),
    memberWorkspaceAt: () => Promise.resolve(WorkspaceId.of('ws_1')),
    opensChat: (
      chat: { readonly startedBy: UserId; readonly teamId: TeamId },
      viewer: UserId,
    ) =>
      Promise.resolve(
        chat.startedBy.equals(viewer) && sees(chat.teamId, viewer),
      ),
    isAdminOf: () => Promise.resolve(over.admin ?? false),
    membersOf: () => Promise.resolve(TeamMembers.of(over.members ?? [])),
    inboxOf: () => Promise.resolve(null),
  });
};
