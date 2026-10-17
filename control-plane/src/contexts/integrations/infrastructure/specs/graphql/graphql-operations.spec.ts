import { graphqlOperations } from '@integrations/infrastructure/specs/graphql/graphql-operations';
import { LINEAR_SDL } from '@integrations/infrastructure/specs/graphql/linear.fake-spec';
import { buildSchema, introspectionFromSchema } from 'graphql';
import { describe, expect, it } from 'vitest';

const AT: { endpoint: string; depth: number | null } = {
  endpoint: 'https://api.linear.app/graphql',
  depth: null,
};

const read = (text = LINEAR_SDL, at = AT) => graphqlOperations(text, at);

const named = (name: string) =>
  read().operations.find((each) => each.name === name);

describe('graphqlOperations', () => {
  it('reads one operation per query and mutation field, named in dashed words', () => {
    expect(read().operations.map((each) => each.name)).toEqual([
      'issue',
      'issues',
      'viewer',
      'issue-create',
      'issue-archive',
      'webhook-create',
    ]);
  });

  it('says a mutation writes, and a query does not', () => {
    expect(named('issue-create')?.writes).toBe(true);
    expect(named('issues')?.writes).toBe(false);
  });

  it('takes each argument by its own name, required where it is non-null without a default', () => {
    expect(
      named('issues')?.inputs.map((each) => [each.name, each.required]),
    ).toEqual([
      ['filter', false],
      ['first', false],
      ['sort', false],
    ]);
    expect(named('issue')?.inputs).toEqual([
      {
        name: 'id',
        schema: { type: 'string' },
        required: true,
        description: null,
      },
    ]);
  });

  it('turns input objects, enums and lists into JSON Schema', () => {
    const input = named('issue-create')?.inputs[0]?.schema;

    expect(input).toEqual({
      type: 'object',
      properties: {
        title: { type: 'string' },
        teamId: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'integer' },
        labelIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'teamId'],
      additionalProperties: false,
    });
    expect(named('issues')?.inputs[2]?.schema).toEqual({
      type: 'string',
      enum: ['createdAt', 'updatedAt'],
    });
    expect(named('webhook-create')?.inputs[0]?.schema).toEqual({});
  });

  it('stops at an input object that refers to itself', () => {
    const filter = named('issues')?.inputs[0]?.schema as {
      properties: { and: { items: unknown } };
    };

    expect(filter.properties.and.items).toEqual({ type: 'object' });
  });

  it('selects scalar fields two levels deep, skipping fields that need arguments', () => {
    expect(named('issue')?.call).toEqual({
      kind: 'graphql',
      endpoint: 'https://api.linear.app/graphql',
      operation: 'query',
      field: 'issue',
      document:
        'query issue($id: String!) { issue(id: $id) { id identifier title priority state { id name type color } team { id key name } } }',
      variables: ['id'],
    });
  });

  it('declares an argument’s default, so leaving it out keeps it', () => {
    const call = named('issues')?.call;

    expect(call?.kind === 'graphql' && call.document).toContain(
      '$first: Int = 50',
    );
  });

  it('stays small however its input types refer to each other', () => {
    const types = Array.from({ length: 20 }, (_, at) => at);
    const sdl = [
      ...types.map(
        (at) =>
          `input F${at} { ${types.map((other) => `f${other}: F${other}`).join(' ')} and: [F${at}!] value: String }`,
      ),
      'type Query { search(filter: F0): String }',
    ].join('\n');
    const started = Date.now();
    const read = graphqlOperations(sdl, AT);

    expect(Date.now() - started).toBeLessThan(5000);
    expect(JSON.stringify(read.operations[0]?.inputs).length).toBeLessThan(
      1_000_000,
    );
  });

  it('selects deeper when requested', () => {
    const call = read(LINEAR_SDL, { ...AT, depth: 3 }).operations.find(
      (each) => each.name === 'issue',
    )?.call;

    expect(call?.kind === 'graphql' && call.document).toContain(
      'comments { nodes { id body } }',
    );
  });

  it('reads an introspection answer as well as a schema written out', () => {
    const introspected = JSON.stringify({
      data: introspectionFromSchema(buildSchema(LINEAR_SDL)),
    });

    expect(read(introspected).operations.map((each) => each.name)).toEqual(
      read().operations.map((each) => each.name),
    );
  });

  it('rejects what is not a GraphQL schema', () => {
    expect(() => read('type {')).toThrow(/not a GraphQL schema/);
  });
});
