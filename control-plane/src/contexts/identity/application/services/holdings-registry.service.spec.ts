import { HoldingsRegistry } from '@identity/application/services/holdings-registry.service';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

describe('HoldingsRegistry', () => {
  it('holds nothing until a context says what a team holds', async () => {
    expect(
      await new HoldingsRegistry<TeamId>().of(TeamId.of('team_1')),
    ).toEqual([]);
  });

  it('gathers what every registered context says the team holds', async () => {
    const holdings = new HoldingsRegistry<TeamId>();

    holdings.register({ heldBy: async () => ['line delivery'] });
    holdings.register({ heldBy: async () => ['skill grafana'] });

    expect(await holdings.of(TeamId.of('team_1'))).toEqual([
      'line delivery',
      'skill grafana',
    ]);
  });
});
