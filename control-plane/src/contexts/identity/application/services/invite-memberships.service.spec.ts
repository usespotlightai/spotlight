import { InviteMemberships } from '@identity/application/services/invite-memberships.service';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { InviteAccepted } from '@identity/domain/events/invite-accepted.event';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { TeamName } from '@identity/domain/value-objects/team-name.vo';
import { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const LEON = UserId.of('user_leon');
const ADA = UserId.of('user_ada');

const ACCEPTED = new InviteAccepted(
  InviteId.of('invite_1'),
  WorkspaceId.of('ws_1'),
  TeamId.of('team_1'),
  ADA,
);

const joining = (found = true) => {
  const savedWorkspace = vi.fn(async (_: Workspace) => {});
  const savedTeam = vi.fn(async (_: Team) => {});
  const memberships = new InviteMemberships(
    {
      find: async () =>
        found
          ? Workspace.rehydrate({
              id: WorkspaceId.of('ws_1'),
              name: WorkspaceName.of('Acme'),
              slug: WorkspaceSlug.of('acme'),
              members: [{ userId: LEON, role: WorkspaceRole.owner }],
            })
          : null,
      save: savedWorkspace,
    } as unknown as WorkspaceRepository,
    {
      find: async () =>
        found
          ? Team.rehydrate({
              id: TeamId.of('team_1'),
              workspaceId: WorkspaceId.of('ws_1'),
              name: TeamName.of('Platform'),
              members: [LEON],
            })
          : null,
      save: savedTeam,
    } as unknown as TeamRepository,
  );

  return { memberships, savedWorkspace, savedTeam };
};

describe('InviteMemberships', () => {
  it('takes whoever accepted into the workspace as a member, and says so', async () => {
    const { memberships, savedWorkspace, savedTeam } = joining();

    await memberships.intoWorkspace(ACCEPTED);

    expect(savedWorkspace.mock.calls[0]?.[0].roleOf(ADA)).toBe(
      WorkspaceRole.member,
    );
    expect(savedTeam).not.toHaveBeenCalled();
    expect(
      savedWorkspace.mock.calls[0]?.[0].pullEvents().map((each) => each.kind),
    ).toEqual(['workspace.member-joined']);
  });

  it('takes them onto the team they were invited to, and says so', async () => {
    const { memberships, savedWorkspace, savedTeam } = joining();

    await memberships.intoTeam(ACCEPTED);

    expect(savedTeam.mock.calls[0]?.[0].holds(ADA)).toBe(true);
    expect(savedWorkspace).not.toHaveBeenCalled();
    expect(
      savedTeam.mock.calls[0]?.[0].pullEvents().map((each) => each.kind),
    ).toEqual(['team.member-joined']);
  });

  it('takes nobody in where the workspace or team is gone', async () => {
    const { memberships, savedWorkspace, savedTeam } = joining(false);

    await memberships.intoWorkspace(ACCEPTED);
    await memberships.intoTeam(ACCEPTED);
    expect(savedWorkspace).not.toHaveBeenCalled();
    expect(savedTeam).not.toHaveBeenCalled();
  });
});
