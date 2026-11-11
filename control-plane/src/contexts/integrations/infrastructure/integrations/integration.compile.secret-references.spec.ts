import { compileIntegration } from '@integrations/infrastructure/integrations/integration.compile';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const expressions = new CelExpressionEngine();

const LINEAR = `integration: linear
connection:
  manual:
    secrets: [secret.LINEAR_OAUTH]
webhook:
  verify:
    hmac:
      algorithm: sha256
      secret: secret.LINEAR_SIGNING
      header: linear-signature
  events:
    - when: \${{ true }}
      lookup:
        request:
          url: https://api.linear.app
          auth:
            secrets: [secret.LINEAR_LOOKUP]
        capture:
          title: \${{ response.title }}
      raise:
        happening: linear.issue.created
        marks:
          - kind: linear.issue
            value: \${{ body.id }}
        attachments:
          each: \${{ body.files }}
          name: \${{ each.name }}
          fetch:
            url: https://uploads.linear.app
            auth:
              secrets: [secret.LINEAR_UPLOADS]
poll:
  every: 60s
  request:
    url: https://api.linear.app
    auth:
      secrets: [secret.LINEAR_POLL]
  events:
    - when: \${{ true }}
      raise:
        happening: linear.issue.polled
        marks:
          - kind: linear.issue
            value: \${{ body.id }}
actions:
  comment:
    request:
      url: https://api.linear.app/graphql
      auth:
        secrets: [secret.LINEAR_API_KEY, secret.LINEAR_API_KEY]
      headers:
        authorization: secret.NOT_INJECTED_HERE
`;

const referencesOf = (text: string) =>
  compileIntegration(parseYaml(text), expressions).secretReferences.map(
    ({ path, name }) => ({ path: path.rendered, name }),
  );

describe('the secrets an integration names', () => {
  it('names each secret where the definition names it', () => {
    expect(referencesOf(LINEAR)).toEqual(
      expect.arrayContaining([
        { path: 'connection.manual.secrets[0]', name: 'LINEAR_OAUTH' },
        { path: 'webhook.verify.hmac.secret', name: 'LINEAR_SIGNING' },
        {
          path: 'webhook.events[0].lookup.request.auth.secrets[0]',
          name: 'LINEAR_LOOKUP',
        },
        {
          path: 'webhook.events[0].raise.attachments.fetch.auth.secrets[0]',
          name: 'LINEAR_UPLOADS',
        },
        { path: 'poll.request.auth.secrets[0]', name: 'LINEAR_POLL' },
        {
          path: 'actions.comment.request.auth.secrets[0]',
          name: 'LINEAR_API_KEY',
        },
        {
          path: 'actions.comment.request.auth.secrets[1]',
          name: 'LINEAR_API_KEY',
        },
      ]),
    );
    expect(referencesOf(LINEAR)).toHaveLength(7);
  });

  it('names the secrets an API description is read and called with', () => {
    expect(
      referencesOf(`integration: petstore
openapi:
  url: https://petstore.example/openapi.json
  auth:
    secrets: [secret.PETSTORE_KEY]
`),
    ).toEqual([{ path: 'openapi.auth.secrets[0]', name: 'PETSTORE_KEY' }]);
  });

  it('names nothing in a definition that names no secret', () => {
    expect(
      referencesOf(`integration: plain
actions:
  ping:
    request:
      url: https://plain.example
`),
    ).toEqual([]);
  });
});
