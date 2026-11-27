import type { HookConfigsPort } from '@configuration/application/ports/hook-configs.port';
import type { IntegrationConfigsPort } from '@configuration/application/ports/integration-configs.port';
import { TeamConfiguration } from '@configuration/application/services/team-configuration.service';
import type { TeamSkillReading } from '@configuration/application/services/team-skill-reading.service';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it } from 'vitest';

describe('TeamConfiguration.enablingToolsOnMarks', () => {
  it('names each planned integration that would enable tools on marks, or whose definition Spotlight cannot read', async () => {
    const configuration = new TeamConfiguration(
      partial<TeamSkillReading>({}),
      partial<HookConfigsPort>({}),
      partial<IntegrationConfigsPort>({
        toolsOnAnyMarkAsPlanned: async ({ tools }: { tools?: unknown }) =>
          tools === 'marked'
            ? ['posthog.query']
            : tools === 'broken'
              ? null
              : [],
      }),
    );

    expect(
      await configuration.enablingToolsOnMarks([
        { key: 'posthog', definition: { tools: 'marked' } },
        { key: 'linear', definition: {} },
        { key: 'broken', definition: { tools: 'broken' } },
        { key: 'deleted', definition: null },
      ]),
    ).toEqual(['posthog', 'broken']);
  });
});
