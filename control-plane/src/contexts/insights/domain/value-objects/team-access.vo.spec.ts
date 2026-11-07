import { TeamNotFoundError } from '@insights/domain/exceptions/team-not-found.error';
import { TeamAccess } from '@insights/domain/value-objects/team-access.vo';
import { WORKSPACE } from '@insights/runs.fake-spec';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

describe('TeamAccess', () => {
  it('is given to anyone on the team, in the team’s workspace', () => {
    const access = TeamAccess.onTeam('team_1', {
      workspaceId: WORKSPACE,
      by: UserId.of('user_ada'),
    });

    expect(access.teamId.value).toBe('team_1');
    expect(access.workspaceId.equals(WORKSPACE)).toBe(true);
  });

  it('is denied to anyone not on the team, as if there were no team', () => {
    expect(() => TeamAccess.onTeam('team_1', null)).toThrow(TeamNotFoundError);
  });
});
