import type { ConnectedIntegration } from '@integrations/application/ports/connected-integrations.port';
import { IntegrationReadings } from '@integrations/infrastructure/acl/integration-readings.adapter';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
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
  const readings = (connections: readonly ConnectedIntegration[] = []) => {
    const ofTeam = vi.fn(async () => [defined(LINEAR)]);

    return {
      ofTeam,
      readings: new IntegrationReadings(
        { ofTeam, everywhere: vi.fn() },
        { ofTeam: vi.fn(async () => connections) },
        new IntegrationReader(expressions, operationsContaining()),
      ),
    };
  };

  it('reads the integrations the team has defined', async () => {
    const { ofTeam, readings: reading } = readings();

    const read = await reading.ofTeam(TeamId.of('team_1'));

    expect(ofTeam).toHaveBeenCalledWith(TeamId.of('team_1'));
    expect(read.integrations).toMatchObject([
      { integration: 'linear', name: 'Linear', path: 'integrations/linear' },
    ]);
  });

  it('says an integration is disconnected until the team connects it', async () => {
    const read = await readings().readings.ofTeam(TeamId.of('team_1'));

    expect(read.integrations[0]).toMatchObject({
      connected: false,
      linkedAccount: null,
    });
  });

  it('says an integration is connected, and the account name of the team on the service', async () => {
    const read = await readings([
      { integration: 'linear', linkedAccount: 'Acme' },
    ]).readings.ofTeam(TeamId.of('team_1'));

    expect(read.integrations[0]).toMatchObject({
      connected: true,
      linkedAccount: 'Acme',
    });
  });
});
