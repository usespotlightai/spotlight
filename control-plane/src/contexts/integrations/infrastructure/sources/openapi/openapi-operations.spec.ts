import { openapiOperations } from '@integrations/infrastructure/sources/openapi/openapi-operations';
import { PETSTORE } from '@integrations/infrastructure/sources/openapi/petstore.fake-spec';
import { describe, expect, it } from 'vitest';

const AT: { url: string | null; baseUrl: string | null; connected: boolean } = {
  url: 'https://petstore3.swagger.io/api/v3/openapi.json',
  baseUrl: null,
  connected: false,
};

const read = (document: unknown = PETSTORE, at = AT) =>
  openapiOperations(document, at);

const named = (name: string) =>
  read().operations.find((each) => each.name === name);

describe('openapiOperations', () => {
  it('reads one operation per path and method, named in dashed words', () => {
    expect(read().operations.map((each) => each.name)).toEqual([
      'update-pet',
      'add-pet',
      'find-pets-by-status',
      'find-pets-by-tags',
      'get-pet-by-id',
      'delete-pet',
      'get-store-inventory',
    ]);
  });

  it('names an operation without an operationId by its method and path', () => {
    expect(named('get-store-inventory')?.upstream).toBe('GET /store/inventory');
  });

  it('calls the first server, read against where the description came from', () => {
    expect(named('add-pet')?.call).toMatchObject({
      kind: 'http',
      method: 'POST',
      server: 'https://petstore3.swagger.io/api/v3',
      path: '/pet',
    });
  });

  it('calls the base URL it is given instead', () => {
    const call = read(PETSTORE, {
      ...AT,
      baseUrl: 'https://pets.example/v3/',
    }).operations[0]?.call;

    expect(call).toMatchObject({ server: 'https://pets.example/v3' });
  });

  it('fills in server variables with their defaults', () => {
    const operations = read(
      {
        ...PETSTORE,
        servers: [
          {
            url: 'https://{region}.pets.example/{version}',
            variables: {
              region: { default: 'eu' },
              version: { default: 'v3' },
            },
          },
        ],
      },
      { url: null, baseUrl: null, connected: false },
    ).operations;

    expect(operations[0]?.call).toMatchObject({
      server: 'https://eu.pets.example/v3',
    });
  });

  it('takes parameters shared by a path, resolving the ones it refers to', () => {
    expect(named('get-pet-by-id')?.inputs).toEqual([
      {
        name: 'petId',
        schema: { type: 'integer', format: 'int64' },
        required: true,
        description: 'ID of pet',
      },
    ]);
    expect(named('get-pet-by-id')?.call).toMatchObject({
      params: [{ name: 'petId', in: 'path', style: 'simple', explode: false }],
    });
  });

  it('takes a JSON body as body, resolving its schema and stopping at a cycle', () => {
    const body = named('add-pet')?.inputs.find((each) => each.name === 'body');
    const schema = body?.schema as {
      required: string[];
      properties: Record<string, { properties?: Record<string, unknown> }>;
    };

    expect(body?.required).toBe(true);
    expect(schema.required).toEqual(['name', 'photoUrls']);
    expect(schema.properties.category?.properties?.name).toEqual({
      type: ['string', 'null'],
      nullable: true,
    });
    expect(schema.properties.category?.properties?.parent).toEqual({});
  });

  it('says an operation writes when it posts, puts, patches or deletes', () => {
    expect(named('add-pet')?.writes).toBe(true);
    expect(named('delete-pet')?.writes).toBe(true);
    expect(named('find-pets-by-status')?.writes).toBe(false);
  });

  it('passes over an operation whose body is not JSON', () => {
    expect(read().passedOver).toEqual([
      'passes over uploadFile. It sends a body that is not JSON. A tool cannot send such a body yet',
    ]);
  });

  it('keeps the first of two operations named alike', () => {
    const twice = read({
      ...PETSTORE,
      paths: {
        '/a': { get: { operationId: 'listPets', summary: 'A' } },
        '/b': { get: { operationId: 'list_pets', summary: 'B' } },
      },
    });

    expect(twice.operations.map((each) => each.upstream)).toEqual(['listPets']);
    expect(twice.passedOver).toEqual([
      'passes over list_pets. Another operation is also called list-pets',
    ]);
  });

  it('drops an optional parameter a tool cannot name, and passes over a required one', () => {
    const odata = read({
      ...PETSTORE,
      paths: {
        '/users': {
          get: {
            operationId: 'listUsers',
            summary: 'List users',
            parameters: [
              { name: '$top', in: 'query', schema: { type: 'integer' } },
            ],
          },
        },
        '/me': {
          get: {
            operationId: 'me',
            summary: 'Me',
            parameters: [{ name: 'session', in: 'cookie', required: true }],
          },
        },
      },
    });

    expect(odata.operations.map((each) => each.name)).toEqual(['list-users']);
    expect(odata.operations[0]?.inputs).toEqual([]);
    expect(odata.passedOver).toEqual([
      'passes over me. It needs its cookie parameter session, which a tool cannot send',
    ]);
  });

  it('calls the server a path or an operation names over the description’s own', () => {
    const operations = read({
      ...PETSTORE,
      paths: {
        '/a': {
          servers: [{ url: 'https://paths.example' }],
          get: { operationId: 'a', summary: 'A' },
          post: {
            operationId: 'b',
            summary: 'B',
            servers: [{ url: 'https://operations.example/v2' }],
          },
        },
      },
    }).operations;

    expect(operations.map((each) => each.call)).toEqual([
      expect.objectContaining({ server: 'https://paths.example' }),
      expect.objectContaining({ server: 'https://operations.example/v2' }),
    ]);
  });

  it('injects a connection only for the host the description came from, unless a baseUrl names one', () => {
    const elsewhere = {
      ...PETSTORE,
      servers: [{ url: 'https://api.elsewhere.example' }],
    };

    expect(read(elsewhere, { ...AT, connected: true }).operations).toEqual([]);
    expect(read(elsewhere, { ...AT, connected: true }).passedOver[0]).toBe(
      'passes over updatePet. It calls api.elsewhere.example. Spotlight injects the token of the connection only for the host of the description or the host that baseUrl names',
    );
    expect(read(PETSTORE, { ...AT, connected: true }).operations).toHaveLength(
      7,
    );
    expect(
      read(elsewhere, {
        ...AT,
        connected: true,
        baseUrl: 'https://api.elsewhere.example',
      }).operations,
    ).toHaveLength(7);
  });

  it('passes over an operation referring to a parameter by a malformed pointer', () => {
    const odd = read({
      ...PETSTORE,
      paths: {
        '/a': {
          get: {
            operationId: 'a',
            summary: 'A',
            parameters: [{ $ref: '#/components/parameters/%E0%A4%A' }],
          },
        },
      },
    });

    expect(odd.operations).toEqual([]);
    expect(odd.passedOver).toEqual([
      'passes over a. One of its parameters cannot be read',
    ]);
  });

  it('refuses a Swagger 2 description, and anything else that is not OpenAPI 3', () => {
    expect(() => read({ swagger: '2.0', paths: {} })).toThrow(/Swagger 2/);
    expect(() => read({ openapi: '4.0.0' })).toThrow(/not an OpenAPI 3/);
    expect(() => read('openapi: 3.0.0')).toThrow(/not an OpenAPI description/);
  });

  it('asks for a base URL where it cannot tell which server to call', () => {
    expect(() =>
      read(
        { ...PETSTORE, servers: [] },
        { url: null, baseUrl: null, connected: false },
      ),
    ).toThrow(/give the openapi block a baseUrl/);
  });
});
