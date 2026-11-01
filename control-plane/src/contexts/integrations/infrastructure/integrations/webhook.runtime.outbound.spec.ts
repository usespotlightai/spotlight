import {
  compileIntegration,
  type ReadableIntegration,
} from '@integrations/infrastructure/integrations/integration.compile';
import type { JwksResolver } from '@integrations/infrastructure/integrations/jwks';
import { WebhookRuntime } from '@integrations/infrastructure/integrations/webhook.runtime';
import type { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import { unlimited } from '@integrations/infrastructure/outbound/outbound-limits.fake-spec';
import { allowingOutbound } from '@integrations/infrastructure/outbound/outbound-policy.fake-spec';
import {
  credentialsFor,
  signingFor,
} from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { OutboundScope } from '@platform/outbound/outbound-scope';
import { scopedTo } from '@platform/outbound/outbound-scope.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const expressions = new CelExpressionEngine();

const compiled = (text: string): ReadableIntegration => {
  const read = compileIntegration(parseYaml(text), expressions);
  if (!read.ok) {
    throw new Error(read.problems.map((each) => each.reason).join(', '));
  }
  return read.readable;
};

const TRACKER = `
integration: tracker
webhook:
  verify:
    jwt:
      jwks: https://issuer.example/jwks.json
      header: authorization
  events:
    - when: '\${{ true }}'
      lookup:
        request:
          method: GET
          url: https://api.tracker.example/users
        capture:
          who: '\${{ "someone" }}'
      raise:
        happening: tracker.filed
        label: Filed
        summary: Something was filed.
        attachments:
          each: '\${{ body.files }}'
          name: '\${{ file.name }}'
          fetch:
            url: https://files.tracker.example/download
        marks:
          - kind: tracker.thing
            value: '\${{ "one" }}'
`;

const policy = allowingOutbound([]);

const sending = async () => {
  policy.allow('https://api.tracker.example/users');
  return { ok: true, status: 200, response: {}, capture: {} };
};

const runtimeFor = (...hosts: string[]) => {
  const keysWithin: boolean[] = [];
  const jwks: JwksResolver = {
    keys: async () => {
      keysWithin.push(OutboundScope.allows('issuer.example'));
      return new Map();
    },
  };
  const outbound = {
    run: sending,
    bytes: async () => {
      policy.allow('https://files.tracker.example/download');
      return { ok: true, status: 200, bytes: new Uint8Array() };
    },
  } as unknown as HttpOutbound;

  return {
    keysWithin,
    runtime: new WebhookRuntime(
      compiled(TRACKER),
      WorkspaceId.of('ws_1'),
      signingFor(),
      () => 1_700_000_000_000,
      jwks,
      outbound,
      credentialsFor(),
      unlimited,
      scopedTo(...hosts),
    ),
  };
};

const delivered = {
  headers: {},
  body: { files: [{ name: 'log.txt' }] },
  raw: null,
};

describe('a webhook within the workspace’s outbound hosts', () => {
  it('never looks up on a host the workspace does not allow', async () => {
    await expect(
      runtimeFor('files.tracker.example').runtime.read(delivered),
    ).rejects.toThrow(
      "Outbound call to api.tracker.example blocked. Host is not on the workspace's allowed list.",
    );
  });

  it('never fetches a file from a host the workspace does not allow', async () => {
    const [read] = await runtimeFor('api.tracker.example').runtime.read(
      delivered,
    );

    await expect(read?.attachments?.[0]?.fetch()).rejects.toThrow(
      "Outbound call to files.tracker.example blocked. Host is not on the workspace's allowed list.",
    );
  });

  it('reads the signing keys within the workspace’s outbound hosts', async () => {
    const { runtime, keysWithin } = runtimeFor('api.tracker.example');
    const head = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString(
      'base64url',
    );

    await runtime.verifies({
      headers: { authorization: `Bearer ${head}.e30.c2ln` },
      body: {},
      raw: Buffer.from('{}'),
    });

    expect(keysWithin).toEqual([false]);
  });
});
