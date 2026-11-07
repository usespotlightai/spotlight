import type { OpenAPIObject } from '@nestjs/swagger';
import {
  audienceOf,
  documentsByAudience,
  type Route,
} from '@platform/http/openapi-audiences';
import { describe, expect, it } from 'vitest';

const route = (
  path: string,
  credential: Route['credential'],
  audience: Route['audience'] = null,
  method = 'get',
): Route => ({ method, path, credential, audience });

describe('audienceOf', () => {
  it.each([
    [route('/workspaces', 'session'), 'web'],
    [route('/invites/{token}', 'anonymous', 'web'), 'web'],
    [
      route('/v1/resources/lines/{id}', 'workspace-token', 'resources'),
      'resources',
    ],
    [
      route('/v1/workspace-tokens/exchange', 'anonymous', 'resources'),
      'resources',
    ],
    [
      route('/teams/{teamId}/insights/cost', 'workspace-token', 'insights'),
      'insights',
    ],
    [route('/runs/{runId}/events', 'runner', null, 'post'), 'hosts'],
    [route('/hosts/claim', 'anonymous', 'hosts', 'post'), 'hosts'],
    [route('/hook-callbacks/task', 'anonymous', 'public'), 'public'],
  ])('puts %o in %s', (each, audience) => {
    expect(audienceOf(each)).toBe(audience);
  });

  it('fails for an anonymous route that names no audience', () => {
    expect(() => audienceOf(route('/somewhere', 'anonymous'))).toThrow(
      'GET /somewhere (anonymous) must name its audience with @InAudience; anonymous routes have none by default.',
    );
  });

  it('fails for a workspace-token route that names no audience', () => {
    expect(() =>
      audienceOf(route('/resources/lines', 'workspace-token')),
    ).toThrow('must name its audience');
  });

  it('fails for a route in an audience that does not take its credential', () => {
    expect(() =>
      audienceOf(
        route('/teams/{teamId}/insights/cost', 'anonymous', 'insights'),
      ),
    ).toThrow(
      'GET /teams/{teamId}/insights/cost (anonymous) is in the insights audience, which takes workspace-token routes only.',
    );
  });
});

describe('documentsByAudience', () => {
  const document = {
    openapi: '3.0.0',
    info: { title: 'test', version: '1' },
    tags: [{ name: 'lines' }, { name: 'runs' }],
    paths: {
      '/v1/resources/lines/{id}': {
        get: {
          tags: ['lines'],
          responses: {
            200: {
              description: 'ok',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Line' },
                },
              },
            },
          },
        },
      },
      '/runs/{runId}/events': {
        post: { tags: ['runs'], responses: { 204: { description: 'ok' } } },
      },
    },
    components: {
      schemas: {
        Line: {
          properties: { station: { $ref: '#/components/schemas/Station' } },
        },
        Station: { type: 'object' },
        Run: { type: 'object' },
      },
    },
  } as unknown as OpenAPIObject;

  const routes = [
    route('/v1/resources/lines/{id}', 'workspace-token', 'resources'),
    route('/runs/{runId}/events', 'runner', null, 'post'),
  ];

  it('keeps the operations, tags and schemas each audience reaches', () => {
    const documents = documentsByAudience(document, routes);

    expect(Object.keys(documents.resources.paths)).toEqual([
      '/v1/resources/lines/{id}',
    ]);
    expect(documents.resources.tags).toEqual([{ name: 'lines' }]);
    expect(Object.keys(documents.resources.components?.schemas ?? {})).toEqual([
      'Line',
      'Station',
    ]);
    expect(Object.keys(documents.hosts.paths)).toEqual([
      '/runs/{runId}/events',
    ]);
    expect(documents.hosts.components?.schemas).toEqual({});
    expect(documents.web.paths).toEqual({});
  });

  it('fails for an operation that matches no controller route', () => {
    expect(() => documentsByAudience(document, routes.slice(1))).toThrow(
      'GET /v1/resources/lines/{id} is in the document but matches no controller route.',
    );
  });
});
