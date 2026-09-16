import type { IntegrationReaderPort } from '@application/ports/integration-reader.port';
import { TeamIntegrations } from '@application/services/team-integrations.service';
import type { Line } from '@domain/aggregates/line.aggregate';
import type { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import { INTEGRATIONS_UNDER } from '@domain/aggregates/team-configuration.aggregate';
import type { DeclaredTool } from '@domain/entities/declared-tool.entity';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const LINE = { factoryId: FactoryId.of('factory_1') } as Line;
const LINEAR = `${INTEGRATIONS_UNDER}/linear.yml`;
const SLACK = `${INTEGRATIONS_UNDER}/slack.yml`;

const tool = (name: string) => ({ name }) as unknown as DeclaredTool;

const integrations = (
  over: { factory?: boolean; configured?: boolean } = {},
) => {
  const files = [
    ConfigurationFile.of(LINEAR, 'linear'),
    ConfigurationFile.of(SLACK, 'slack'),
    ConfigurationFile.of('.spotlight/lines/delivery/line.yml', 'line'),
  ];

  const factories = {
    find: async () =>
      over.factory === false ? null : { teamId: TeamId.of('team_1') },
  } as unknown as FactoryRepository;

  const configurations = {
    findFor: async () =>
      over.configured === false
        ? null
        : ({
            under: (folder: string) =>
              files.filter((each) => each.path.startsWith(`${folder}/`)),
          } as unknown as TeamConfiguration),
  } as unknown as TeamConfigurationRepository;

  const reader = {
    read: (read: readonly ConfigurationFile[]) => ({
      integrations: read.map((file) => ({
        offers: [tool(`${file.text}.comment`)],
      })),
      problems: [],
    }),
  } as unknown as IntegrationReaderPort;

  return new TeamIntegrations(factories, configurations, reader);
};

describe('TeamIntegrations', () => {
  it('offers the tools every integration file of the team declares', async () => {
    const offered = await integrations().offered(LINE);

    expect(
      offered.map((each) => (each as unknown as { name: string }).name),
    ).toEqual(['linear.comment', 'slack.comment']);
  });

  it('offers nothing for a line whose factory is gone', async () => {
    expect(await integrations({ factory: false }).offered(LINE)).toEqual([]);
  });

  it('offers nothing for a team with no configuration applied', async () => {
    expect(await integrations({ configured: false }).offered(LINE)).toEqual([]);
  });
});
