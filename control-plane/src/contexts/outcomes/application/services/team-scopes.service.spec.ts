import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { TeamScopes } from '@outcomes/application/services/team-scopes.service';
import { WORKSPACE } from '@outcomes/domain/outcomes.fake-spec';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T15:00:00.000Z');

const scopes = (onTeam: boolean) =>
  new TeamScopes(
    new OutcomesAccess({
      membershipOnTeam: async () =>
        onTeam ? { workspaceId: WORKSPACE, by: UserId.of('user_ada') } : null,
      namesOf: async () => new Map(),
    }),
    { now: () => NOW, sleep: async () => {} },
  );

describe('TeamScopes', () => {
  it('clears a team member and reads the period they requested up to now', async () => {
    const { access, period } = await scopes(true).scope(
      'team_1',
      PersonPrincipal.of(UserId.of('user_ada')),
      '30d',
    );

    expect(access.teamId.value).toBe('team_1');
    expect(access.workspaceId).toEqual(WORKSPACE);
    expect(period).toEqual(InsightsPeriod.of('30d', NOW));
  });

  it('denies a person off the team', async () => {
    await expect(
      scopes(false).scope(
        'team_1',
        PersonPrincipal.of(UserId.of('user_bob')),
        '7d',
      ),
    ).rejects.toThrow();
  });
});
