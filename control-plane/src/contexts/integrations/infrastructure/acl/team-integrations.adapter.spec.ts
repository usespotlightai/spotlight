import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { ToolDeclarationsPort } from '@integrations/application/ports/tool-declarations.port';
import { ProvidedTools } from '@integrations/application/services/provided-tools.service';
import { InferredOutputSchema } from '@integrations/domain/aggregates/inferred-output-schema.aggregate';
import type { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { TeamIntegrations } from '@integrations/infrastructure/acl/team-integrations.adapter';
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

const integrationsOf = (
  declarations: ToolDeclarationsPort,
  schemas = new InMemoryInferredOutputSchemas(),
) =>
  new TeamIntegrations(
    new ProvidedTools(
      { ofTeam: async () => [] } as unknown as DefinedIntegrationsPort,
      declarations,
      schemas,
    ),
  );

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

  return integrationsOf(
    { declared: async () => declarations, enabledOnMarks: () => [] },
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

  it('names the tools enabled on the given mark kinds', async () => {
    let asked: readonly MarkKind[] = [];

    const tools = await integrationsOf({
      declared: async () => [],
      enabledOnMarks: (_definitions, kinds) => {
        asked = kinds;
        return [ToolName.of('sentry.get-issue')];
      },
    }).toolsOnMarks(TEAM, ['sentry.issue']);

    expect(tools).toEqual(['sentry.get-issue']);
    expect(asked.map((each) => each.value)).toEqual(['sentry.issue']);
  });
});
