import { NotOnTeamError } from '@outcomes/domain/exceptions/not-on-team.error';
import { WORKSPACE } from '@outcomes/domain/outcomes.fake-spec';
import { OutcomesClearance } from '@outcomes/domain/services/outcomes-clearance';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

describe('OutcomesClearance', () => {
  it('is given to anyone on the team, in the team’s workspace', () => {
    const clearance = OutcomesClearance.onTeam('team_1', {
      workspaceId: WORKSPACE,
      by: UserId.of('user_ada'),
    });

    expect(clearance.teamId.value).toBe('team_1');
    expect(clearance.workspaceId.equals(WORKSPACE)).toBe(true);
  });

  it('is refused to anyone not on the team, as if there were no team', () => {
    expect(() => OutcomesClearance.onTeam('team_1', null)).toThrow(
      NotOnTeamError,
    );
  });
});
