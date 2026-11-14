import { scopedTo } from '@identity/application/ports/workspace-outbound-scope.fake-spec';
import type { ActiveConnection } from '@integrations/application/ports/integration-runtime.port';
import { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import {
  compileIntegration,
  type ReadableIntegration,
  type RequestIR,
} from '@integrations/infrastructure/integrations/integration.compile';
import { WebhookRuntime } from '@integrations/infrastructure/integrations/webhook.runtime';
import type { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { unlimited } from '@integrations/infrastructure/outbound/outbound-limits.fake-spec';
import {
  credentialsFor,
  signingFor,
} from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import type { CelVariables } from '@platform/expressions/cel-variables';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

const expressions = new CelExpressionEngine();

const compiled = (text: string): ReadableIntegration => {
  const read = compileIntegration(parseYaml(text), expressions);
  if (!read.ok) {
    throw new Error(read.problems.map((each) => each.reason).join(', '));
  }
  return read.readable;
};

const CHAT = `
integration: chat
connection:
  oauth2:
    authorize: https://chat.example/oauth/authorize
    token: https://chat.example/oauth/token
webhook:
  verify:
    token:
      secret: secret.CHAT_SIGNING_SECRET
  events:
    - when: '\${{ true }}'
      lookup:
        request:
          method: GET
          url: https://chat.example/api/users.info
          auth:
            oauth2:
              connection: true
        capture:
          email: '\${{ response.email }}'
      raise:
        happening: chat.mentioned
        label: Mentioned
        summary: Mentioned the app.
        attachments:
          each: '\${{ body.files }}'
          name: '\${{ file.name }}'
          fetch:
            url: https://files.chat.example/download
            auth:
              oauth2:
                connection: true
        marks:
          - kind: chat.thread
            value: '\${{ "one" }}'
`;

const connectionWith = (
  token: string,
  refreshed: string | null = null,
): ActiveConnection & { readonly unauthorized: ReturnType<typeof vi.fn> } => ({
  token: AccessToken.of(token),
  owner: ConnectionOwner.team(),
  linkedAccount: null,
  unauthorized: vi.fn(async () => AccessToken.maybe(refreshed)),
});

const reading = (
  connection: ActiveConnection | null,
  answers: readonly number[] = [200],
  fetchAnswers: readonly number[] = [200],
) => {
  const sentWith: unknown[] = [];
  const fetchedWith: unknown[] = [];
  let answered = 0;
  let fetched = 0;
  const outbound = {
    run: async (_request: RequestIR, against: CelVariables) => {
      sentWith.push(against.connection);
      const status = answers[Math.min(answered, answers.length - 1)] ?? 200;
      answered += 1;

      return {
        ok: status === 200,
        status,
        response: { email: 'ada@example.com' },
        capture: {},
      };
    },
    bytes: async (_request: RequestIR, against: CelVariables) => {
      fetchedWith.push(against.connection);
      const status =
        fetchAnswers[Math.min(fetched, fetchAnswers.length - 1)] ?? 200;
      fetched += 1;

      if (status !== 200) {
        throw new UpstreamError(
          'fetching a file',
          `the host answered ${status} without it`,
          status,
        );
      }

      return new Uint8Array();
    },
  } as unknown as HttpOutbound;
  const connectionOf = vi.fn(async () => connection);
  const runtime = new WebhookRuntime(
    compiled(CHAT),
    WorkspaceId.of('ws_1'),
    signingFor(),
    { now: () => new Date(1_700_000_000_000), sleep: async () => {} },
    { keys: async () => new Map() },
    outbound,
    credentialsFor(),
    unlimited,
    scopedTo('chat.example', 'files.chat.example'),
    connectionOf,
  );

  return { runtime, sentWith, fetchedWith, connectionOf };
};

const delivered = {
  headers: {},
  body: { files: [{ name: 'shot.png' }] },
  raw: null,
};

describe('a webhook that calls back with the team’s connection', () => {
  it('looks up and fetches files with the team’s token, read once per delivery', async () => {
    const { runtime, sentWith, fetchedWith, connectionOf } = reading(
      connectionWith('xoxb-team'),
    );

    const [read] = await runtime.read(delivered);
    await read?.attachments?.[0]?.fetch();

    expect(sentWith).toEqual(['xoxb-team']);
    expect(fetchedWith).toEqual(['xoxb-team']);
    expect(connectionOf).toHaveBeenCalledOnce();
  });

  it('refreshes the token once when the lookup is unauthorized, and asks again', async () => {
    const connection = connectionWith('xoxb-old', 'xoxb-new');
    const { runtime, sentWith } = reading(connection, [401, 200]);

    await runtime.read(delivered);

    expect(connection.unauthorized).toHaveBeenCalledExactlyOnceWith(
      AccessToken.of('xoxb-old'),
    );
    expect(sentWith).toEqual(['xoxb-old', 'xoxb-new']);
  });

  it('refreshes the token once when a file fetch is unauthorized, and fetches again', async () => {
    const connection = connectionWith('xoxb-old', 'xoxb-new');
    const { runtime, fetchedWith } = reading(connection, [200], [401, 200]);

    const [read] = await runtime.read(delivered);
    await read?.attachments?.[0]?.fetch();

    expect(connection.unauthorized).toHaveBeenCalledExactlyOnceWith(
      AccessToken.of('xoxb-old'),
    );
    expect(fetchedWith).toEqual(['xoxb-old', 'xoxb-new']);
  });

  it('fetches files with the token a lookup refreshed in the same delivery', async () => {
    const connection = connectionWith('xoxb-old', 'xoxb-new');
    const { runtime, fetchedWith } = reading(connection, [401, 200]);

    const [read] = await runtime.read(delivered);
    await read?.attachments?.[0]?.fetch();

    expect(connection.unauthorized).toHaveBeenCalledOnce();
    expect(fetchedWith).toEqual(['xoxb-new']);
  });

  it('refreshes only once, and keeps a lookup still unauthorized after it as a failed lookup', async () => {
    const connection = connectionWith('xoxb-old', 'xoxb-new');
    const { runtime, sentWith } = reading(connection, [401, 401]);

    await expect(runtime.read(delivered)).resolves.toHaveLength(1);

    expect(connection.unauthorized).toHaveBeenCalledOnce();
    expect(sentWith).toEqual(['xoxb-old', 'xoxb-new']);
  });

  it('refreshes only once, and fails a file fetch still unauthorized after it', async () => {
    const connection = connectionWith('xoxb-old', 'xoxb-new');
    const { runtime, fetchedWith } = reading(connection, [200], [401, 401]);

    const [read] = await runtime.read(delivered);

    await expect(read?.attachments?.[0]?.fetch()).rejects.toThrow(
      'fetching a file: the host answered 401 without it',
    );
    expect(connection.unauthorized).toHaveBeenCalledOnce();
    expect(fetchedWith).toEqual(['xoxb-old', 'xoxb-new']);
  });

  it('sends no token while the team has not connected', async () => {
    const { runtime, sentWith, fetchedWith } = reading(null);

    const [read] = await runtime.read(delivered);
    await read?.attachments?.[0]?.fetch();

    expect(sentWith).toEqual([undefined]);
    expect(fetchedWith).toEqual([undefined]);
  });
});
