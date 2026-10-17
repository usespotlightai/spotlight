import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import { InferredOutputSchema } from '@integrations/domain/aggregates/inferred-output-schema.aggregate';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { TeamIntegrations } from '@integrations/infrastructure/acl/team-integrations.adapter';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { InMemoryInferredOutputSchemas } from '@integrations/integrations.inferred.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const declared = (tool: string, over: Partial<ToolDeclaration> = {}) => ({
  tool,
  integrationName: 'Linear',
  description: 'Does a thing.',
  inputs: [],
  approval: null,
  inferredOutput: null,
  ...over,
});

const providing = async (declarations: readonly ToolDeclaration[]) => {
  const schemas = new InMemoryInferredOutputSchemas();

  for (const tool of ['linear.comment', 'linear.unlisted']) {
    await schemas.save(
      InferredOutputSchema.first({
        teamId: TEAM,
        tool: ToolName.of(tool),
        answer: { url: 'https://linear.app/c/1' },
        at: new Date('2026-10-05T12:00:00.000Z'),
      }),
    );
  }

  return new TeamIntegrations(
    { ofTeam: async () => [] } as unknown as DefinedIntegrationsPort,
    { declared: () => declarations } as unknown as IntegrationReader,
    schemas,
  ).provided(
    TEAM,
    declarations.map((each) => each.tool),
  );
};

describe('TeamIntegrations', () => {
  it('says what a tool answered before, where it was called', async () => {
    const [comment, search] = await providing([
      declared('linear.comment'),
      declared('linear.search'),
    ]);

    expect(comment?.inferredOutput).toEqual({
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
      additionalProperties: false,
    });
    expect(search?.inferredOutput).toBeNull();
  });
});
