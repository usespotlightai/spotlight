import type {
  TeamDirectoryPort,
  TeamProfile,
} from '@identity/application/ports/team-directory.port';
import type {
  IntegrationRecord,
  IntegrationResourcesPort,
} from '@integrations/application/ports/integration-resources.port';
import { IntegrationConfigs } from '@integrations/infrastructure/acl/integration-configs.adapter';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const configsOver = (integration: string) =>
  new IntegrationConfigs(
    partial<IntegrationResourcesPort>({
      withId: () =>
        Promise.resolve({
          id: 'definition_1',
          version: 1,
          integration,
          definition: {},
          tools: [],
          generatedFrom: null,
          reading: null,
          teamId: TEAM,
        } satisfies IntegrationRecord),
    }),
    partial<TeamDirectoryPort>({
      find: () => Promise.resolve(partial<TeamProfile>({ key: 'acme' })),
    }),
    partial<IntegrationReader>({ secretReferencesOf: () => [] }),
  );

describe('IntegrationConfigs', () => {
  it('reads a stored integration name as stored, the reserved one too (R6-04)', async () => {
    expect(
      (await configsOver('catalog').withId('definition_1'))?.address,
    ).toContain('catalog');
  });

  it('reports a stored integration name of a shape it cannot take as an inconsistent state, not a refused input (R6-04)', async () => {
    await expect(
      configsOver('Not A Name').withId('definition_1'),
    ).rejects.toBeInstanceOf(InconsistentStateError);
  });
});
