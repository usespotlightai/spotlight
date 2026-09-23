import type { IntegrationReaderPort } from '@configuration/application/ports/integration-reader.port';
import { TeamIntegrations } from '@integrations/presentation/ports/team-integrations.adapter';
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

const integrations = (defined = true) => {
  const sources = defined ? ['linear', 'slack'] : [];

  const readings = {
    ofTeam: async () => ({
      integrations: sources.map((source) => ({
        source,
        offers: [tool(`${source}.comment`)],
      })),
      problems: [],
    }),
  } as unknown as IntegrationReaderPort;

  return new TeamIntegrations(readings);
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

  it('offers and hears nothing for a team that defined no integration', async () => {
    expect(await integrations(false).offered(TEAM)).toEqual([]);
    expect(await integrations(false).listening(TEAM)).toEqual([]);
  });
});
