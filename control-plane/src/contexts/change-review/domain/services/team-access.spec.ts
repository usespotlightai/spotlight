import { TeamAccess } from '@change-review/domain/services/team-access';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');

const TEAM = TeamId.of('team_1');

const access = TeamAccess.of({ workspaceId: WORKSPACE, teamId: TEAM });

describe('TeamAccess', () => {
  it('reaches work on a task of the member’s own team', () => {
    expect(access.reaches({ workspaceId: WORKSPACE, teamId: TEAM })).toBe(true);
  });

  it('reaches no work on another team’s task, even in the same workspace', () => {
    expect(
      access.reaches({
        workspaceId: WORKSPACE,
        teamId: TeamId.of('team_2'),
      }),
    ).toBe(false);
  });

  it('reaches no work on a task that is on no team', () => {
    expect(access.reaches({ workspaceId: WORKSPACE, teamId: null })).toBe(
      false,
    );
  });

  it('reaches no work in another workspace', () => {
    expect(
      access.reaches({ workspaceId: WorkspaceId.of('ws_2'), teamId: TEAM }),
    ).toBe(false);
  });
});
