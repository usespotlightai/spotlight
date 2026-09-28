import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { NotOnTeamError } from '@memory/domain/exceptions/not-on-team.error';
import { MemoryClearance } from '@memory/domain/services/memory-clearance';
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

const cleared = () =>
  MemoryClearance.onTeam('team_1', { workspaceId: WORKSPACE, by: ADA });

const kept = (teamId: string) =>
  Memory.written({
    id: MemoryId.of('memory_1'),
    handle: MemoryHandle.of(1),
    workspaceId: WORKSPACE,
    kind: 'preference',
    body: MemoryBody.of('Keep it simple.'),
    scope: MemoryScope.of({ teamId: TeamId.of(teamId) }),
    grounds: null,
    by: MemoryDecision.of({ by: ADA, at: new Date('2026-09-27T10:00:00Z') }),
  });

describe('MemoryClearance', () => {
  it('is given to anyone on the team, as themselves', () => {
    const clearance = cleared();

    expect(clearance.teamId.value).toBe('team_1');
    expect(clearance.by.equals(ADA)).toBe(true);
  });

  it('is refused to anyone not on the team, as if there were no team', () => {
    expect(() => MemoryClearance.onTeam('team_1', null)).toThrow(
      NotOnTeamError,
    );
    expect(() => MemoryClearance.onTeam('team_1', null)).toThrow(
      'There is no team team_1 for this caller',
    );
  });

  it('holds only the team’s own memories', () => {
    expect(cleared().holds(kept('team_1'))).toBe(true);
    expect(cleared().holds(kept('team_2'))).toBe(false);
  });

  it('reviews only a task of the team, in its workspace', () => {
    const task = { workspaceId: WORKSPACE, teamId: TeamId.of('team_1') };

    expect(cleared().reviews(task)).toBe(true);
    expect(cleared().reviews({ ...task, teamId: TeamId.of('team_2') })).toBe(
      false,
    );
    expect(cleared().reviews({ ...task, teamId: null })).toBe(false);
    expect(
      cleared().reviews({ ...task, workspaceId: WorkspaceId.of('ws_2') }),
    ).toBe(false);
  });

  it('sees only the team’s runs', () => {
    const site = {
      teamId: TeamId.of('team_1'),
      lineId: null,
      stationId: null,
      repositories: [],
    };

    expect(cleared().sees(site)).toBe(true);
    expect(cleared().sees({ ...site, teamId: TeamId.of('team_2') })).toBe(
      false,
    );
  });
});
