import { mcpOperations } from '@integrations/infrastructure/sources/mcp/mcp-operations';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { describe, expect, it } from 'vitest';

const tool = (over: Partial<Tool> = {}): Tool => ({
  name: 'search_issues',
  description: 'Search the tracker.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to look for' },
      limit: { type: 'integer' },
    },
    required: ['query'],
  },
  annotations: { readOnlyHint: true },
  ...over,
});

describe('mcpOperations', () => {
  it('names each tool in words, keeping the server’s own name to call it by', () => {
    const [read] = mcpOperations([tool()]).operations;

    expect(read).toMatchObject({
      name: 'search-issues',
      upstream: 'search_issues',
      description: 'Search the tracker.',
      call: { kind: 'mcp', tool: 'search_issues' },
    });
  });

  it('takes each property of the input schema as an input, required as the server says', () => {
    const [read] = mcpOperations([tool()]).operations;

    expect(read?.inputs).toEqual([
      {
        name: 'query',
        schema: { type: 'string', description: 'What to look for' },
        required: true,
        description: 'What to look for',
      },
      {
        name: 'limit',
        schema: { type: 'integer' },
        required: false,
        description: null,
      },
    ]);
  });

  it('takes a tool to write unless the server says it only reads', () => {
    const writes = (annotations: Tool['annotations']) =>
      mcpOperations([tool({ annotations })]).operations[0]?.writes;

    expect(writes({ readOnlyHint: true })).toBe(false);
    expect(writes({ destructiveHint: true })).toBe(true);
    expect(writes(undefined)).toBe(true);
  });

  it('describes a tool by its title when it says nothing else', () => {
    const [read] = mcpOperations([
      tool({ description: undefined, title: 'Search issues' }),
    ]).operations;

    expect(read?.description).toBe('Search issues');
  });

  it('passes over a tool taking an input a tool cannot, or named like another', () => {
    const read = mcpOperations([
      tool(),
      tool({ name: 'search-issues' }),
      tool({
        name: 'odd',
        inputSchema: { type: 'object', properties: { 'a b': {} } },
      }),
    ]);

    expect(read.operations.map((each) => each.upstream)).toEqual([
      'search_issues',
    ]);
    expect(read.passedOver).toEqual([
      'passes over odd. It takes a b, which a tool cannot take',
      'passes over search-issues. Another operation is also called search-issues',
    ]);
  });
});
