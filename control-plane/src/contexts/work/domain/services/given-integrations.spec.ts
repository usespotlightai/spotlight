import { givenIntegrations } from '@work/domain/services/given-integrations';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

const declared = (tool: string, offeredBy: string | null = null) =>
  DeclaredTool.of({ tool: Tool.of(tool), description: 'Does it.', offeredBy });

describe('givenIntegrations', () => {
  it('counts the tools from each integration under its name, in the order given', () => {
    expect(
      givenIntegrations([
        declared('linear.issue-create', 'Linear'),
        declared('petstore.pet-add', 'Petstore'),
        declared('linear.comment', 'Linear'),
        declared('catalog.web-search@1.1.0', 'the Spotlight catalog'),
      ]),
    ).toEqual([
      { name: 'Linear', tools: 2 },
      { name: 'Petstore', tools: 1 },
      { name: 'the Spotlight catalog', tools: 1 },
    ]);
  });

  it('leaves Spotlight’s own tools out', () => {
    expect(givenIntegrations([declared('pull-request')])).toEqual([]);
  });

  it('names an integration by its source where nothing names it', () => {
    expect(givenIntegrations([declared('grafana.search')])).toEqual([
      { name: 'grafana', tools: 1 },
    ]);
  });
});
