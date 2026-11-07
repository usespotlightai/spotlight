import { TeamNotFoundError } from '@insights/domain/exceptions/team-not-found.error';
import { ViewedTeam } from '@insights/domain/value-objects/viewed-team.vo';
import { WORKSPACE } from '@insights/runs.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

describe('ViewedTeam', () => {
  it('is given to anyone who may view the team, in the team’s workspace', () => {
    const access = ViewedTeam.onTeam(TeamId.of('team_1'), {
      workspaceId: WORKSPACE,
      by: UserId.of('user_ada'),
    });

    expect(access.teamId.value).toBe('team_1');
    expect(access.workspaceId.equals(WORKSPACE)).toBe(true);
  });

  it('is denied to anyone who may not view the team, as if there were no team', () => {
    expect(() => ViewedTeam.onTeam(TeamId.of('team_1'), null)).toThrow(
      TeamNotFoundError,
    );
  });
});
