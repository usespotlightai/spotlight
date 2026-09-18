import { INTEGRATIONS_UNDER } from '@configuration/application/contracts/configuration-layout.contract';
import type {
  Applied,
  AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
import type { IntegrationReaderPort } from '@configuration/application/ports/integration-reader.port';
import { TeamIntegrations } from '@integrations/presentation/ports/team-integrations.adapter';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const tool = (name: string): ToolDeclaration => ({
  tool: name,
  description: name,
  inputs: [],
  approval: null,
});

const integrations = (configured = true) => {
  const files = [
    ConfigurationFile.of(`${INTEGRATIONS_UNDER}/linear.yml`, 'linear'),
    ConfigurationFile.of(`${INTEGRATIONS_UNDER}/slack.yml`, 'slack'),
    ConfigurationFile.of('.spotlight/lines/delivery/line.yml', 'line'),
  ];

  const applied = {
    of: async () => (configured ? ({ files } as unknown as Applied) : null),
  } as unknown as AppliedConfigurationPort;

  const reader = {
    read: (read: readonly ConfigurationFile[]) => ({
      integrations: read.map((file) => ({
        source: file.text,
        offers: [tool(`${file.text}.comment`)],
      })),
      problems: [],
    }),
  } as unknown as IntegrationReaderPort;

  return new TeamIntegrations(applied, reader);
};

describe('TeamIntegrations', () => {
  it('offers the tools every integration file of the team declares', async () => {
    const offered = await integrations().offered(TEAM);

    expect(offered.map((each) => each.tool)).toEqual([
      'linear.comment',
      'slack.comment',
    ]);
  });

  it('listens to every integration the team configured', async () => {
    expect(await integrations().listening(TEAM)).toEqual(['linear', 'slack']);
  });

  it('offers and hears nothing for a team with no configuration applied', async () => {
    expect(await integrations(false).offered(TEAM)).toEqual([]);
    expect(await integrations(false).listening(TEAM)).toEqual([]);
  });
});
