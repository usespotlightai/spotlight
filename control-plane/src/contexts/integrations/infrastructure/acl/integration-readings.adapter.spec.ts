import { IntegrationReadings } from '@integrations/infrastructure/acl/integration-readings.adapter';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const expressions = new CelExpressionEngine();

const LINEAR = `
integration: linear
name: Linear
actions:
  comment:
    request:
      method: POST
      url: https://api.linear.app/graphql
`;

describe('IntegrationReadings', () => {
  it('reads the integrations the team has defined', async () => {
    const ofTeam = vi.fn(async () => [defined(LINEAR)]);
    const readings = new IntegrationReadings(
      { ofTeam, everywhere: vi.fn() },
      new IntegrationReader(expressions),
    );

    const read = await readings.ofTeam(TeamId.of('team_1'));

    expect(ofTeam).toHaveBeenCalledWith(TeamId.of('team_1'));
    expect(read.integrations).toMatchObject([
      { source: 'linear', name: 'Linear', path: 'integrations/linear' },
    ]);
  });
});
