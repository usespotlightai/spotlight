import type { LinkedHost } from '@integrations/application/ports/linked-hosts.port';
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
  const readings = (links: readonly LinkedHost[] = []) => {
    const ofTeam = vi.fn(async () => [defined(LINEAR)]);

    return {
      ofTeam,
      readings: new IntegrationReadings(
        { ofTeam, everywhere: vi.fn() },
        { ofTeam: vi.fn(async () => links) },
        new IntegrationReader(expressions, operationsContaining()),
      ),
    };
  };

  it('reads the integrations the team has defined', async () => {
    const { ofTeam, readings: reading } = readings();

    const read = await reading.ofTeam(TeamId.of('team_1'));

    expect(ofTeam).toHaveBeenCalledWith(TeamId.of('team_1'));
    expect(read.integrations).toMatchObject([
      { source: 'linear', name: 'Linear', path: 'integrations/linear' },
    ]);
  });

  it('says an integration is unlinked until the team connects its host', async () => {
    const read = await readings().readings.ofTeam(TeamId.of('team_1'));

    expect(read.integrations[0]).toMatchObject({ linked: false, handle: null });
  });

  it('says an integration is linked, and what the host calls the team, once connected', async () => {
    const read = await readings([
      { source: 'linear', handle: 'Acme' },
    ]).readings.ofTeam(TeamId.of('team_1'));

    expect(read.integrations[0]).toMatchObject({
      linked: true,
      handle: 'Acme',
    });
  });
});
