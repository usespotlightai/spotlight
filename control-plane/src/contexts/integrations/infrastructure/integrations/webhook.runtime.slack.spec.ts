import { createHmac } from 'node:crypto';
import {
  compileIntegration,
  type ReadableIntegration,
} from '@integrations/infrastructure/integrations/integration.compile';
import { WebhookRuntime } from '@integrations/infrastructure/integrations/webhook.runtime';
import type { HttpOutbound } from '@integrations/infrastructure/outbound/http-outbound';
import {
  credentialsFor,
  signingFor,
} from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import { dottedOf } from '@shared-kernel/domain/value-objects/field-path.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

const expressions = new CelExpressionEngine();

const SIGNING = 'slack_signing_secret';
const WORKSPACE = WorkspaceId.of('ws_1');
const NOW = 1_700_000_000;

const SLACK = `
integration: slack
name: Slack

webhook:
  verify:
    hmac:
      algorithm: sha256
      secret: secret.SLACK_SIGNING_SECRET
      header: x-slack-signature
      prefix: "v0="
      signed: '\${{ "v0:" + headers["x-slack-request-timestamp"] + ":" + raw }}'
      freshness:
        at: '\${{ headers["x-slack-request-timestamp"] }}'
        within: 300s
  respond:
    when: '\${{ body.type == "url_verification" }}'
    body: '\${{ body.challenge }}'
  mine: '\${{ body.event.bot_id != "" }}'
  events:
    - when: '\${{ body.event.type == "app_mention" }}'
      raise:
        happening: slack.app_mention
        label: Mentioned
        summary: Mentioned Spotlight in Slack.
        opens:
          onto: delivery
          at: triage
          title: '\${{ body.event.text }}'
        marks:
          - kind: slack.thread
            value: '\${{ body.event.channel + ":" + body.event.ts }}'
          - kind: slack.channel
            find: false
            value: '\${{ body.event.channel }}'
    - when: '\${{ body.event.type == "message" && body.event.thread_ts != "" }}'
      raise:
        happening: slack.message.replied
        label: Replied
        summary: Replied in a Slack thread.
        answers: true
        message: '\${{ body.event.text }}'
        marks:
          - kind: slack.thread
            value: '\${{ body.event.channel + ":" + body.event.thread_ts }}'

actions:
  post-message:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      auth:
        secrets: [secret.SLACK_BOT_TOKEN]
      body: '\${{ {"channel": target.channel, "text": ask.body} }}'
      expect:
        success: '\${{ response.ok }}'
      capture:
        thread: '\${{ target.channel + ":" + response.ts }}'

on:
  task.asked:
    do: post-message
    to:
      channel: '\${{ task.marks["slack.channel"] }}'
      thread: '\${{ task.marks["slack.thread"] }}'
    routes:
      delivery: C0DELIVERY
    mark:
      - kind: slack.thread
        value: '\${{ capture.thread }}'
`;

const compiled = (): ReadableIntegration => {
  const read = compileIntegration(parseYaml(SLACK), expressions);

  if (!read.ok) {
    throw new Error(
      `fixture will not compile: ${read.problems.map((each) => `${dottedOf(each.field)} ${each.reason}`).join(', ')}`,
    );
  }

  return read.readable;
};

const runtime = (secret: string | null = SIGNING) =>
  new WebhookRuntime(
    compiled(),
    WORKSPACE,
    signingFor(secret === null ? {} : { SLACK_SIGNING_SECRET: secret }),
    () => NOW * 1000,
    { keys: async () => new Map() },
    {} as HttpOutbound,
    credentialsFor(),
  );

const raw = (body: unknown) => Buffer.from(JSON.stringify(body));

const slackSigned = (body: unknown, ts: number, secret = SIGNING) =>
  `v0=${createHmac('sha256', secret)
    .update(`v0:${ts}:${raw(body).toString('utf8')}`)
    .digest('hex')}`;

const delivered = (body: unknown, ts = NOW, secret = SIGNING) => ({
  headers: {
    'x-slack-signature': slackSigned(body, ts, secret),
    'x-slack-request-timestamp': String(ts),
  },
  body,
  raw: raw(body),
});

const mention = {
  event: { type: 'app_mention', text: 'do it', channel: 'C0REQ', ts: '170.1' },
};

const reply = {
  event: {
    type: 'message',
    text: 'the queue',
    channel: 'C0REQ',
    thread_ts: '170.1',
  },
};

describe('the Slack webhook runtime', () => {
  describe('verifying the v0 signed base', () => {
    it('takes a delivery signed over v0:timestamp:body', async () => {
      expect(await runtime().verifies(delivered(mention))).toBe(true);
    });

    it('rejects one signed with another secret', async () => {
      expect(await runtime().verifies(delivered(mention, NOW, 'wrong'))).toBe(
        false,
      );
    });

    it('fails one where the workspace has no such secret', async () => {
      await expect(runtime(null).verifies(delivered(mention))).rejects.toThrow(
        'Secret SLACK_SIGNING_SECRET not found. Please define it first.',
      );
    });

    it('rejects a replay outside the freshness window', async () => {
      expect(await runtime().verifies(delivered(mention, NOW - 301))).toBe(
        false,
      );
    });

    it('takes one still inside it', async () => {
      expect(await runtime().verifies(delivered(mention, NOW - 299))).toBe(
        true,
      );
    });
  });

  describe('the handshake', () => {
    it('echoes a url_verification challenge', () => {
      const body = { type: 'url_verification', challenge: 'c_abc' };

      expect(runtime().answer(delivered(body))).toBe('c_abc');
    });

    it('answers nothing for an ordinary delivery', () => {
      expect(runtime().answer(delivered(mention))).toBeNull();
    });
  });

  describe('reading', () => {
    it('opens a task on the delivery role from a mention', async () => {
      const [read] = await runtime().read(delivered(mention));

      expect(read?.happening).toBe('slack.app_mention');
      expect(read?.opens?.onto).toBe('delivery');
      expect(read?.opens?.at).toBe('triage');
      expect(read?.concerns.marks).toEqual([
        { kind: 'slack.thread', value: 'C0REQ:170.1' },
      ]);
    });

    it('has an ambient mark without finding a task by it', async () => {
      const [read] = await runtime().read(delivered(mention));

      expect(read?.concerns.marks.map((each) => each.kind)).toEqual([
        'slack.thread',
      ]);
      expect(read?.opens?.marks.map((each) => each.kind)).toEqual([
        'slack.thread',
        'slack.channel',
      ]);
    });

    it('reads a thread reply as a person speaking', async () => {
      const [read] = await runtime().read(delivered(reply));

      expect(read?.happening).toBe('slack.message.replied');
      expect(read?.answers).toBe(true);
      expect(read?.message?.body).toBe('the queue');
    });

    it('marks its own posts as its own doing', async () => {
      const echo = {
        event: {
          type: 'message',
          bot_id: 'B0',
          channel: 'C0REQ',
          thread_ts: '170.1',
        },
      };

      expect((await runtime().read(delivered(echo)))[0]?.ourOwn).toBe(true);
    });

    it('does not mark a person’s reply as its own', async () => {
      expect((await runtime().read(delivered(reply)))[0]?.ourOwn).toBe(false);
    });
  });

  describe('enriching before it raises', () => {
    const WITH_LOOKUP = `
integration: slack
webhook:
  verify:
    token:
      secret: secret.SLACK_SIGNING_SECRET
  events:
    - when: '\${{ body.event.type == "app_mention" }}'
      lookup:
        request:
          method: GET
          url: https://slack.com/api/users.info
          query:
            user: '\${{ body.event.user }}'
          auth:
            secrets: [secret.SLACK_BOT_TOKEN]
        capture:
          email: '\${{ response.user.profile.email }}'
      raise:
        happening: slack.app_mention
        opens:
          onto: delivery
          title: '\${{ body.event.text }}'
          assignBy:
            email: '\${{ email }}'
        marks:
          - kind: slack.thread
            value: '\${{ body.event.ts }}'
`;

    const SLACK = credentialsFor({
      SLACK_BOT_TOKEN: { host: 'slack.com', value: 'xoxb-1' },
    });

    const looking = (response: unknown, ok = true) => {
      const read = compileIntegration(parseYaml(WITH_LOOKUP), expressions);
      if (!read.ok) {
        throw new Error(read.problems.map((each) => each.reason).join(', '));
      }

      const run = vi.fn(async () => ({
        ok,
        status: 200,
        response,
        capture: {},
      }));

      const runtime = new WebhookRuntime(
        read.readable,
        WORKSPACE,
        signingFor(),
        () => NOW * 1000,
        { keys: async () => new Map() },
        { run } as unknown as HttpOutbound,
        SLACK,
      );

      return { runtime, run };
    };

    const mentioning = {
      event: { type: 'app_mention', text: 'do it', user: 'U0', ts: '170.1' },
    };

    it('calls the lookup and assigns the opened task by the email it found', async () => {
      const { runtime, run } = looking({
        ok: true,
        user: { profile: { email: 'dev@acme.test' } },
      });

      const [read] = await runtime.read({
        headers: {},
        body: mentioning,
        raw: null,
      });

      expect(run).toHaveBeenCalledOnce();
      expect(read?.opens?.assignEmail).toBe('dev@acme.test');
    });

    it('opens unassigned where the lookup fails', async () => {
      const { runtime } = looking(null, false);

      const [read] = await runtime.read({
        headers: {},
        body: mentioning,
        raw: null,
      });

      expect(read?.opens?.assignEmail).toBeNull();
    });
  });
});
