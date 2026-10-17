import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import { InviteMemberships } from '@identity/application/services/invite-memberships.service';
import { Team } from '@identity/domain/aggregates/team.aggregate';
import { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceInviteAccepted } from '@identity/domain/events/workspace-invite-accepted.event';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { InviteTerms } from '@identity/domain/value-objects/invite-terms.vo';
import { TeamKey } from '@identity/domain/value-objects/team-key.vo';
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
const ACME = WorkspaceId.of('ws_1');

const accepted = (role = WorkspaceRole.admin) =>
  new WorkspaceInviteAccepted(
    InviteId.of('invite_1'),
    ACME,
    InviteTerms.of(role, [
      TeamId.of('team_1'),
      TeamId.of('team_gone'),
      TeamId.of('team_elsewhere'),
    ]),
    ADA,
  );

const team = (id: string, workspaceId = ACME) =>
  Team.rehydrate({
    id: TeamId.of(id),
    workspaceId,
    key: TeamKey.of(id.replace('_', '-')),
    name: TeamName.of(id),
    members: [LEON],
    version: 0,
  });

const joining = (
  over: {
    found?: boolean;
    adaIs?: WorkspaceRole | null;
    adaLeft?: boolean;
  } = {},
) => {
  let workspace: Workspace | null =
    over.found === false
      ? null
      : Workspace.rehydrate({
          id: ACME,
          name: WorkspaceName.of('Acme'),
          slug: WorkspaceSlug.of('acme'),
          members: [
            { userId: LEON, role: WorkspaceRole.owner },
            ...(over.adaIs ? [{ userId: ADA, role: over.adaIs }] : []),
          ],
          version: 0,
        });
  const teams: Record<string, Team> =
    over.found === false
      ? {}
      : {
          team_1: team('team_1'),
          team_elsewhere: team('team_elsewhere', WorkspaceId.of('ws_2')),
        };
  const savedWorkspace = vi.fn(async (saved: Workspace) => {
    workspace = saved;
  });
  const savedTeam = vi.fn(async (saved: Team) => {
    teams[saved.id.value] = saved;
  });
  const memberships = new InviteMemberships(
    {
      find: async () => workspace,
      save: savedWorkspace,
    } as unknown as WorkspaceRepository,
    {
      find: async (id: TeamId) => teams[id.value] ?? null,
      save: savedTeam,
    } as unknown as TeamRepository,
    {
      find: async (id: UserId) =>
        over.adaLeft ? null : { id: id.value, name: 'Ada', image: null },
    } as unknown as PersonReaderPort,
  );

  return { memberships, savedWorkspace, savedTeam };
};

describe('InviteMemberships', () => {
  it('takes whoever accepted into the workspace with the role invited, and says so', async () => {
    const { memberships, savedWorkspace } = joining();

    await memberships.joined(accepted());

    const saved = savedWorkspace.mock.calls[0]?.[0];
    expect(saved?.roleOf(ADA)).toBe(WorkspaceRole.admin);
    expect(saved?.pullEvents().map((each) => each.kind)).toEqual([
      'workspace.member-joined',
    ]);
  });

  it('keeps the role somebody already has, whether higher or lower', async () => {
    for (const [current, invited] of [
      [WorkspaceRole.owner, WorkspaceRole.member],
      [WorkspaceRole.member, WorkspaceRole.admin],
    ] as const) {
      const { memberships, savedWorkspace, savedTeam } = joining({
        adaIs: current,
      });

      await memberships.joined(accepted(invited));

      expect(savedWorkspace).not.toHaveBeenCalled();
      expect(savedTeam.mock.calls[0]?.[0].hasMember(ADA)).toBe(true);
    }
  });

  it('takes them onto each team named that is still in the workspace, skipping the rest', async () => {
    const { memberships, savedTeam } = joining();

    await memberships.joined(accepted());

    expect(savedTeam).toHaveBeenCalledTimes(1);
    expect(savedTeam.mock.calls[0]?.[0].id.value).toBe('team_1');
    expect(savedTeam.mock.calls[0]?.[0].hasMember(ADA)).toBe(true);
  });

  it('changes nothing more when the acceptance is received twice', async () => {
    const { memberships, savedWorkspace, savedTeam } = joining();

    await memberships.joined(accepted());
    await memberships.joined(accepted());

    expect(savedWorkspace).toHaveBeenCalledTimes(1);
    expect(savedTeam).toHaveBeenCalledTimes(1);
  });

  it('takes nobody in where the workspace is gone', async () => {
    const { memberships, savedWorkspace, savedTeam } = joining({
      found: false,
    });

    await memberships.joined(accepted());

    expect(savedWorkspace).not.toHaveBeenCalled();
    expect(savedTeam).not.toHaveBeenCalled();
  });

  it('takes nobody in where the person who accepted is gone', async () => {
    const { memberships, savedWorkspace, savedTeam } = joining({
      adaLeft: true,
    });

    await memberships.joined(accepted());

    expect(savedWorkspace).not.toHaveBeenCalled();
    expect(savedTeam).not.toHaveBeenCalled();
  });
});
