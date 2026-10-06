import { secretsWornBy } from '@integrations/infrastructure/integrations/worn-secrets';
import { describe, expect, it } from 'vitest';

const LINEAR = {
  integration: 'linear',
  connection: { manual: { secrets: ['secret.LINEAR_OAUTH'] } },
  webhook: {
    verify: { hmac: { secret: 'secret.LINEAR_SIGNING' } },
    events: [
      {
        when: 'true',
        lookup: {
          request: {
            url: 'https://api.linear.app',
            auth: { token: { secret: 'secret.LINEAR_LOOKUP' } },
          },
        },
        raise: {
          happening: 'linear.issue.created',
          attaches: {
            fetch: {
              url: 'https://uploads.linear.app',
              auth: { secrets: ['secret.LINEAR_UPLOADS'] },
            },
          },
        },
      },
    ],
  },
  poll: {
    request: {
      url: 'https://api.linear.app',
      auth: { secrets: ['secret.LINEAR_POLL'] },
    },
  },
  actions: {
    comment: {
      request: {
        url: 'https://api.linear.app/graphql',
        auth: { secrets: ['secret.LINEAR_API_KEY', 'secret.lower', 'plain'] },
        headers: { authorization: 'secret.NOT_WORN_HERE' },
      },
    },
    secrets: { request: { url: 'https://api.linear.app' } },
  },
  tools: { comment: { description: 'secret.NOT_A_REFERENCE' } },
};

describe('secretsWornBy', () => {
  it('finds each secret a definition wears, where the schema lets it name one', () => {
    expect(
      secretsWornBy(LINEAR).map(({ path, name }) => ({
        path: path.segments,
        name,
      })),
    ).toEqual([
      {
        path: ['actions', 'comment', 'request', 'auth', 'secrets', 0],
        name: 'LINEAR_API_KEY',
      },
      { path: ['webhook', 'verify', 'hmac', 'secret'], name: 'LINEAR_SIGNING' },
      {
        path: [
          'webhook',
          'events',
          0,
          'lookup',
          'request',
          'auth',
          'token',
          'secret',
        ],
        name: 'LINEAR_LOOKUP',
      },
      {
        path: [
          'webhook',
          'events',
          0,
          'raise',
          'attaches',
          'fetch',
          'auth',
          'secrets',
          0,
        ],
        name: 'LINEAR_UPLOADS',
      },
      {
        path: ['poll', 'request', 'auth', 'secrets', 0],
        name: 'LINEAR_POLL',
      },
      {
        path: ['connection', 'manual', 'secrets', 0],
        name: 'LINEAR_OAUTH',
      },
    ]);
  });

  it('finds the secrets an API description is read and called with', () => {
    expect(
      secretsWornBy({
        integration: 'petstore',
        openapi: {
          url: 'https://petstore.example/openapi.json',
          auth: { secrets: ['secret.PETSTORE_KEY'] },
        },
      }).map(({ path, name }) => ({ path: path.rendered, name })),
    ).toEqual([{ path: 'openapi.auth.secrets[0]', name: 'PETSTORE_KEY' }]);
  });

  it('finds nothing in a definition that wears no secret', () => {
    expect(secretsWornBy({ integration: 'plain' })).toEqual([]);
  });
});
