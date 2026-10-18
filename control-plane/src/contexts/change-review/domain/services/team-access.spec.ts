import { TeamAccess } from '@change-review/domain/services/team-access';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const TEAM = TeamId.of('team_1');

const access = TeamAccess.of({ workspaceId: WORKSPACE, teamId: TEAM });

describe('TeamAccess', () => {
  it('allows work on a task of the member’s own team', () => {
    expect(access.allows({ workspaceId: WORKSPACE, teamId: TEAM })).toBe(true);
  });

  it('allows no work on another team’s task, even in the same workspace', () => {
    expect(
      access.allows({
        workspaceId: WORKSPACE,
        teamId: TeamId.of('team_2'),
      }),
    ).toBe(false);
  });

  it('allows no work on a task that is on no team', () => {
    expect(access.allows({ workspaceId: WORKSPACE, teamId: null })).toBe(false);
  });

  it('allows no work in another workspace', () => {
    expect(
      access.allows({ workspaceId: WorkspaceId.of('ws_2'), teamId: TEAM }),
    ).toBe(false);
  });
});
