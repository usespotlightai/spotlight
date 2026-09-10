import { createHmac } from 'node:crypto';
import { Mark } from '@domain/value-objects/mark.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import {
  compileIntegration,
  type ReadableIntegration,
} from '@infrastructure/integrations/integration.compile';
import { WebhookRuntime } from '@infrastructure/integrations/webhook.runtime';
import type { HttpOutbound } from '@infrastructure/outbound/http-outbound';
import { describe, expect, it, vi } from 'vitest';

/**
 * Slack drives the same generic runtime as any host: the primitives — an HMAC
 * over a named base, a freshness window, a handshake, a self-echo guard — are
 * what let its quirks live in a file rather than in code. This is the only
 * place Slack is named in this layer, and it doubles as the reference file.
 */
const SIGNING = 'slack_signing_secret';
const WORKSPACE = WorkspaceId.of('ws_1');
const NOW = 1_700_000_000;

const SLACK = `
version: 1
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
        told: Mentioned Spotlight in Slack.
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
        told: Replied in a Slack thread.
        spoken: true
        say: '\${{ body.event.text }}'
        marks:
          - kind: slack.thread
            value: '\${{ body.event.channel + ":" + body.event.thread_ts }}'

actions:
  post-message:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      headers:
        authorization: '\${{ "Bearer " + secret.SLACK_BOT_TOKEN }}'
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
  const read = compileIntegration('.spotlight/integrations/slack.yml', SLACK);

  if (!read.ok) {
    throw new Error(
      `fixture will not compile: ${read.problems.map((each) => `${each.at} ${each.reason}`).join(', ')}`,
    );
  }

  return read.readable;
};

const runtime = (secret: string | null = SIGNING) =>
  new WebhookRuntime(
    compiled(),
    WORKSPACE,
    secret === null ? new Map() : new Map([['SLACK_SIGNING_SECRET', secret]]),
    () => NOW * 1000,
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

    it('refuses one signed with another secret', async () => {
      expect(await runtime().verifies(delivered(mention, NOW, 'wrong'))).toBe(
        false,
      );
    });

    it('refuses one where the workspace set no secret', async () => {
      expect(await runtime(null).verifies(delivered(mention))).toBe(false);
    });

    it('refuses a replay outside the freshness window', async () => {
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

      expect(read?.happening.value).toBe('slack.app_mention');
      expect(read?.opens?.onto.value).toBe('delivery');
      expect(read?.opens?.at).toBe('triage');
      expect(read?.concerns.marks).toEqual([
        Mark.of('slack.thread', 'C0REQ:170.1'),
      ]);
    });

    // The channel is ambient — shared by every mention there — so it is kept
    // off the concerns a task is found by, but still worn by the task it opens
    // so a reply can be routed back.
    it('wears an ambient mark without finding a task by it', async () => {
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

      expect(read?.happening.value).toBe('slack.message.replied');
      expect(read?.spoken).toBe(true);
      expect(read?.said?.body).toBe('the queue');
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
version: 1
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
            token:
              secret: secret.SLACK_BOT_TOKEN
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

    const looking = (response: unknown, ok = true) => {
      const read = compileIntegration(
        '.spotlight/integrations/slack.yml',
        WITH_LOOKUP,
      );
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
        new Map([['SLACK_BOT_TOKEN', 'xoxb-1']]),
        () => NOW * 1000,
        null,
        { run } as unknown as HttpOutbound,
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

    it('opens unassigned where the lookup is refused', async () => {
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
