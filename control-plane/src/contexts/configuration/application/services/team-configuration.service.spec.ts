import type { HookConfigsPort } from '@configuration/application/ports/hook-configs.port';
import type { IntegrationConfigsPort } from '@configuration/application/ports/integration-configs.port';
import { TeamConfiguration } from '@configuration/application/services/team-configuration.service';
import type { TeamSkillReading } from '@configuration/application/services/team-skill-reading.service';
import { describe, expect, it } from 'vitest';

describe('TeamConfiguration.enablingToolsOnMarks', () => {
  it('names each planned integration that would enable tools on marks, or whose definition Spotlight cannot read', async () => {
    const configuration = new TeamConfiguration(
      {} as TeamSkillReading,
      {} as HookConfigsPort,
      {
        toolsOnAnyMarkAsPlanned: async (key: string) =>
          key === 'posthog' ? ['posthog.query'] : key === 'broken' ? null : [],
      } as unknown as IntegrationConfigsPort,
    );

    expect(
      await configuration.enablingToolsOnMarks([
        { key: 'posthog', definition: {} },
        { key: 'linear', definition: {} },
        { key: 'broken', definition: {} },
        { key: 'deleted', definition: null },
      ]),
    ).toEqual(['posthog', 'broken']);
  });
});
