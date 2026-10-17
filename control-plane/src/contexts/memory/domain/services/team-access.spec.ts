import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { NotOnTeamError } from '@memory/domain/exceptions/not-on-team.error';
import { TeamAccess } from '@memory/domain/services/team-access';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const ADA = UserId.of('user_ada');

const teamAccess = () =>
  TeamAccess.onTeam('team_1', { workspaceId: WORKSPACE, by: ADA });

const approved = (teamId: string) =>
  Memory.write({
    id: MemoryId.of('memory_1'),
    handle: MemoryHandle.of(1),
    workspaceId: WORKSPACE,
    kind: 'preference',
    body: MemoryBody.of('Keep it simple.'),
    scope: MemoryScope.of({ teamId: TeamId.of(teamId) }),
    grounds: null,
    by: MemoryDecision.of({ by: ADA, at: new Date('2026-09-27T10:00:00Z') }),
  });

describe('TeamAccess', () => {
  it('is granted to anyone on the team, as themselves', () => {
    const access = teamAccess();

    expect(access.teamId.value).toBe('team_1');
    expect(access.by.equals(ADA)).toBe(true);
  });

  it('is denied to anyone not on the team, as if there were no team', () => {
    expect(() => TeamAccess.onTeam('team_1', null)).toThrow(NotOnTeamError);
    expect(() => TeamAccess.onTeam('team_1', null)).toThrow(
      'Team team_1 not found.',
    );
  });

  it('includes only the team’s own memories', () => {
    expect(teamAccess().includes(approved('team_1'))).toBe(true);
    expect(teamAccess().includes(approved('team_2'))).toBe(false);
  });

  it('reviews only a task of the team, in its workspace', () => {
    const task = { workspaceId: WORKSPACE, teamId: TeamId.of('team_1') };

    expect(teamAccess().reviews(task)).toBe(true);
    expect(teamAccess().reviews({ ...task, teamId: TeamId.of('team_2') })).toBe(
      false,
    );
    expect(teamAccess().reviews({ ...task, teamId: null })).toBe(false);
    expect(
      teamAccess().reviews({ ...task, workspaceId: WorkspaceId.of('ws_2') }),
    ).toBe(false);
  });

  it('sees only the team’s runs', () => {
    const site = {
      teamId: TeamId.of('team_1'),
      lineId: null,
      stationId: null,
      repositories: [],
    };

    expect(teamAccess().sees(site)).toBe(true);
    expect(teamAccess().sees({ ...site, teamId: TeamId.of('team_2') })).toBe(
      false,
    );
  });
});
