import {
  type OperationCall,
  type OperationParameter,
  SpecOperation,
} from '@integrations/domain/value-objects/spec-operation.vo';
import { operationRequest } from '@integrations/infrastructure/outbound/operation-request';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { describe, expect, it } from 'vitest';

const param = (
  name: string,
  place: OperationParameter['in'],
  over: Partial<OperationParameter> = {},
): OperationParameter => ({
  name,
  in: place,
  style: place === 'query' ? 'form' : 'simple',
  explode: place === 'query',
  ...over,
});

const operation = (call: OperationCall, names: readonly string[]) =>
  SpecOperation.of({
    name: 'find-pets',
    upstream: 'findPets',
    description: 'Find pets.',
    inputs: names.map((name) => ({
      name,
      schema: InputSchema.of({}),
      required: false,
      description: null,
    })),
    writes: false,
    call,
  });

const http = (
  params: readonly OperationParameter[],
  body: { input: string; contentType: string } | null = null,
) =>
  operation(
    {
      kind: 'http',
      method: body ? 'POST' : 'GET',
      server: 'https://pets.example/v3',
      path: '/owners/{ownerId}/pets',
      params,
      body,
    },
    [...params.map((each) => each.name), ...(body ? [body.input] : [])],
  );

describe('operationRequest', () => {
  it('fills the path, encoding what it puts there', () => {
    expect(
      operationRequest(http([param('ownerId', 'path')]), {
        ownerId: 'a/b c',
      }).url,
    ).toBe('https://pets.example/v3/owners/a%2Fb%20c/pets');
  });

  it('repeats an exploded list in the query, and joins one that is not', () => {
    const exploded = http([param('ownerId', 'path'), param('tags', 'query')]);
    const joined = http([
      param('ownerId', 'path'),
      param('tags', 'query', { explode: false }),
    ]);

    expect(
      operationRequest(exploded, { ownerId: '1', tags: ['a', 'b'] }).url,
    ).toBe('https://pets.example/v3/owners/1/pets?tags=a&tags=b');
    expect(
      operationRequest(joined, { ownerId: '1', tags: ['a', 'b'] }).url,
    ).toBe('https://pets.example/v3/owners/1/pets?tags=a%2Cb');
  });

  it('joins a list that is not exploded by its style', () => {
    const styled = (style: string) =>
      http([
        param('ownerId', 'path'),
        param('tags', 'query', { style, explode: false }),
      ]);

    expect(
      operationRequest(styled('spaceDelimited'), {
        ownerId: '1',
        tags: ['a', 'b'],
      }).url,
    ).toBe('https://pets.example/v3/owners/1/pets?tags=a+b');
    expect(
      operationRequest(styled('pipeDelimited'), {
        ownerId: '1',
        tags: ['a', 'b'],
      }).url,
    ).toBe('https://pets.example/v3/owners/1/pets?tags=a%7Cb');
  });

  it('writes an object in a form that is not exploded as its fields and values in turn', () => {
    expect(
      operationRequest(
        http([
          param('ownerId', 'path'),
          param('filter', 'query', { explode: false }),
        ]),
        { ownerId: '1', filter: { name: 'rex', age: 3 } },
      ).url,
    ).toBe('https://pets.example/v3/owners/1/pets?filter=name%2Crex%2Cage%2C3');
  });

  it('writes an object in the query as a deep object where it says so, and as JSON otherwise', () => {
    const deep = http([
      param('ownerId', 'path'),
      param('filter', 'query', { style: 'deepObject' }),
    ]);
    const plain = http([
      param('ownerId', 'path'),
      param('filter', 'query', { style: 'spaceDelimited' }),
    ]);
    const filter = { name: 'rex', age: 3 };

    expect(operationRequest(deep, { ownerId: '1', filter }).url).toBe(
      'https://pets.example/v3/owners/1/pets?filter%5Bname%5D=rex&filter%5Bage%5D=3',
    );
    expect(
      new URL(
        operationRequest(plain, { ownerId: '1', filter }).url,
      ).searchParams.get('filter'),
    ).toBe('{"name":"rex","age":3}');
  });

  it('sends header parameters, and the body as JSON', () => {
    const request = operationRequest(
      http([param('ownerId', 'path'), param('X-Trace', 'header')], {
        input: 'body',
        contentType: 'application/json',
      }),
      { ownerId: '1', 'X-Trace': 't-1', body: { name: 'rex' } },
    );

    expect(request).toEqual({
      method: 'POST',
      url: 'https://pets.example/v3/owners/1/pets',
      headers: {
        accept: 'application/json',
        'X-Trace': 't-1',
        'content-type': 'application/json',
      },
      body: '{"name":"rex"}',
    });
  });

  it('leaves out what was not given', () => {
    expect(
      operationRequest(
        http([param('ownerId', 'path'), param('tags', 'query')]),
        {
          ownerId: '1',
        },
      ),
    ).toEqual({
      method: 'GET',
      url: 'https://pets.example/v3/owners/1/pets',
      headers: { accept: 'application/json' },
    });
  });

  it('posts a GraphQL operation with the variables it was given', () => {
    const request = operationRequest(
      operation(
        {
          kind: 'graphql',
          endpoint: 'https://api.linear.app/graphql',
          operation: 'mutation',
          field: 'issueCreate',
          document: 'mutation issueCreate($input: IssueCreateInput!) { … }',
          variables: ['input', 'dryRun'],
        },
        ['input', 'dryRun'],
      ),
      { input: { title: 'Broken' } },
    );

    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://api.linear.app/graphql');
    expect(JSON.parse(request.body ?? '')).toEqual({
      query: 'mutation issueCreate($input: IssueCreateInput!) { … }',
      variables: { input: { title: 'Broken' } },
    });
  });
});
