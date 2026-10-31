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
  method = 'get',
): Route => ({ method, path, credential });

describe('audienceOf', () => {
  it.each([
    [route('/workspaces', 'session'), 'web'],
    [route('/invites/{token}', 'anonymous'), 'web'],
    [route('/v1/resources/lines/{id}', 'workspace-token'), 'resources'],
    [route('/v1/expressions/check', 'workspace-token', 'post'), 'resources'],
    [route('/v1/workspace-tokens/exchange', 'anonymous', 'post'), 'resources'],
    [route('/teams/{teamId}/insights/cost', 'workspace-token'), 'insights'],
    [route('/runs/{runId}/events', 'runner', 'post'), 'hosts'],
    [route('/hosts/claim', 'anonymous', 'post'), 'hosts'],
    [route('/hook-callbacks/task', 'anonymous'), 'public'],
  ])('puts %o in %s', (each, audience) => {
    expect(audienceOf(each)).toBe(audience);
  });

  it('fails for an anonymous route under no listed path', () => {
    expect(() => audienceOf(route('/somewhere', 'anonymous'))).toThrow(
      'GET /somewhere (anonymous) must belong to exactly one audience, but belongs to none.',
    );
  });

  it('fails for a workspace-token route outside the versioned API and teams', () => {
    expect(() =>
      audienceOf(route('/resources/lines', 'workspace-token')),
    ).toThrow('belongs to none');
  });

  it('matches whole path segments only', () => {
    expect(() => audienceOf(route('/hostsx', 'anonymous'))).toThrow(
      'belongs to none',
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
    route('/v1/resources/lines/{id}', 'workspace-token'),
    route('/runs/{runId}/events', 'runner', 'post'),
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
