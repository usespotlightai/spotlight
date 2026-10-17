import { DependentsRegistry } from '@identity/application/services/dependents-registry.service';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

describe('DependentsRegistry', () => {
  it('has no dependents until a context names some for the team', async () => {
    expect(
      await new DependentsRegistry<TeamId>().of(TeamId.of('team_1')),
    ).toEqual([]);
  });

  it('gathers the dependents that every registered context names for the team', async () => {
    const registry = new DependentsRegistry<TeamId>();

    registry.register({ dependentsOf: async () => ['line delivery'] });
    registry.register({ dependentsOf: async () => ['skill grafana'] });

    expect(await registry.of(TeamId.of('team_1'))).toEqual([
      'line delivery',
      'skill grafana',
    ]);
  });
});
