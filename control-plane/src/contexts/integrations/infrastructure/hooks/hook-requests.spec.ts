import { createHash } from 'node:crypto';
import { OutboundHostsUnreadError } from '@identity/application/errors/outbound-hosts-unread.error';
import type { WorkspaceOutboundScopePort } from '@identity/application/ports/workspace-outbound-scope.port';
import type { HookRequest } from '@integrations/application/ports/hook-requests.port';
import type {
  HookEventInstance,
  ListeningHook,
} from '@integrations/application/ports/hook-runtime.port';
import type { OutboundLimitsPort } from '@integrations/application/ports/outbound-limits.port';
import { taskViewOf } from '@integrations/application/ports/tasks-for-hooks.fake-spec';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { pullRequestOpening } from '@integrations/domain/value-objects/hook-event-facts.fake-spec';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { HookOccurrenceKey } from '@integrations/domain/value-objects/hook-occurrence-key.vo';
import { HookSigningSecret } from '@integrations/domain/value-objects/hook-signing-secret.vo';
import { HookStepName } from '@integrations/domain/value-objects/hook-step-name.vo';
import type { WaitingHookStep } from '@integrations/domain/value-objects/hook-step-outcome.vo';
import { HookRequests } from '@integrations/infrastructure/hooks/hook-requests';
import { unlimited } from '@integrations/infrastructure/outbound/outbound-limits.fake-spec';
import { allowingOutbound } from '@integrations/infrastructure/outbound/outbound-policy.fake-spec';
import {
  scopedTo,
  unscoped,
} from '@platform/outbound/outbound-scope.fake-spec';
import { signatureOf } from '@platform/outbound/standard-webhooks';
import type { NetworkCallsPort } from '@runs/application/ports/network-calls.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const SECRET = HookSigningSecret.of(
  `whsec_${Buffer.from('s'.repeat(32)).toString('base64')}`,
);

const HOOK: ListeningHook = {
  id: HookDefinitionId.of('hook_1'),
  key: HookKey.of('dba-review'),
  teamId: TeamId.of('team_1'),
  blocks: true,
  compiled: null,
  broken: null,
  written: null,
};

const INSTANCE: HookEventInstance = {
  on: 'pull-request.opening',
  occurrence: HookOccurrenceKey.of('occurrence_1'),
  firing: null,
  run: null,
  at: NOW,
  event: pullRequestOpening(['db/migrations/1.sql']),
  task: taskViewOf(),
};

const hookRequest = (overrides: Partial<HookRequest> = {}): HookRequest => ({
  hook: HOOK,
  instance: INSTANCE,
  step: HookStepName.of('check'),
  url: 'https://dba.example.com/review',
  headers: { 'x-team': 'core' },
  body: '{"files":["db/migrations/1.sql"]}',
  fromNetwork: false,
  signing: { kind: 'hmac' },
  deadline: new Date(NOW.getTime() + 10_000),
  waitMode: 'wait',
  ...overrides,
});

const TOKEN = 'callback_token';

const network = (): NetworkCallsPort => ({
  queue: vi.fn(async () => 'call_1'),
  stateOf: vi.fn(async () => ({ kind: 'waiting' as const })),
  answered: vi.fn(async () => ({
    kind: 'answered' as const,
    response: {
      status: 200,
      headers: {},
      body: new TextEncoder().encode('{"ok":true}'),
      ms: 40,
      error: null,
    },
  })),
});

const requests = (
  reply: () => Promise<Response>,
  calls: NetworkCallsPort = network(),
  allowed = ['example.com', '*.example.com'],
  secret: HookSigningSecret | null = SECRET,
  limits: OutboundLimitsPort = unlimited,
  hosts: WorkspaceOutboundScopePort = unscoped,
  signs = true,
) => {
  const fetch = vi.fn(reply);
  const signed = vi.fn(async () => 'jwt');

  return {
    fetch,
    calls,
    signed,
    requests: new HookRequests(
      {
        callbackUrl: 'https://spotlight.example.com/api/hook-callbacks',
        policy: allowingOutbound(allowed),
      },
      { signingSecretOf: async () => secret },
      {
        signs,
        issuer: 'https://spotlight.example.com/api',
        signed,
        keys: async () => ({ keys: [] }),
      },
      calls,
      limits,
      hosts,
      { now: () => new Date(), sleep: async () => {} },
      fetch as unknown as typeof globalThis.fetch,
    ),
  };
};

const sentHeaders = (fetch: ReturnType<typeof vi.fn>) =>
  (fetch.mock.calls[0] as [string, RequestInit])[1].headers as Record<
    string,
    string
  >;

describe('HookRequests', () => {
  it('signs as Standard Webhooks do, with a callback token and a stable id', async () => {
    const { fetch, requests: sending } = requests(
      async () => new Response('{"ok":true}', { status: 200 }),
    );

    const stepResult = await sending.sent(hookRequest(), TOKEN, NOW);
    const headers = sentHeaders(fetch);

    expect(stepResult.outcome).toEqual({
      name: HookStepName.of('check'),
      status: 'done',
      output: { ok: true },
    });
    expect(headers['webhook-signature']).toBe(
      signatureOf(
        SECRET.key,
        headers['webhook-id'] as string,
        Math.floor(NOW.getTime() / 1000),
        hookRequest().body,
      ),
    );
    expect(headers['spotlight-callback-token']).toBe('callback_token');
    expect(headers['spotlight-callback-url']).toBe(
      'https://spotlight.example.com/api/hook-callbacks',
    );
    expect(headers['x-team']).toBe('core');

    await sending.sent(hookRequest(), TOKEN, NOW);
    expect(sentHeaders(fetch)['webhook-id']).toBe(headers['webhook-id']);
  });

  it('keeps the signature and tokens out of the trace', async () => {
    const { requests: sending } = requests(
      async () => new Response('{}', { status: 200 }),
    );

    const stepResult = await sending.sent(hookRequest(), TOKEN, NOW);

    expect(JSON.stringify(stepResult.trace)).not.toMatch(
      /callback_token|webhook-signature/,
    );
  });

  it('sends nothing when a hook that signs with a secret has none', async () => {
    const { fetch, requests: sending } = requests(
      async () => new Response('{}'),
      network(),
      ['example.com'],
      null,
    );

    await expect(
      sending.sent(hookRequest(), TOKEN, NOW),
    ).resolves.toMatchObject({
      outcome: { status: 'failed', reason: expect.stringMatching(/no secret/) },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stores no more of an answer than it can show', async () => {
    const { requests: sending } = requests(
      async () => new Response('x'.repeat(100_000), { status: 200 }),
    );

    const stepResult = await sending.sent(hookRequest(), TOKEN, NOW);

    expect((stepResult.outcome as { output: string }).output).toHaveLength(
      16 * 1024,
    );
  });

  it('fails a call whose answer stops early, in place of keeping part of it', async () => {
    const { requests: sending } = requests(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"allow": tr'));
              controller.error(new Error('the connection reset'));
            },
          }),
          { status: 200 },
        ),
    );

    const stepResult = await sending.sent(hookRequest(), TOKEN, NOW);

    expect(stepResult.outcome).not.toMatchObject({ status: 'done' });
    expect(JSON.stringify(stepResult.outcome)).toContain(
      'the connection reset',
    );
  });

  it('carries an OIDC token that binds the message and its body', async () => {
    const {
      fetch,
      signed,
      requests: sending,
    } = requests(async () => new Response('{}', { status: 200 }));

    await sending.sent(
      hookRequest({ signing: { kind: 'oidc', audience: 'https://dba' } }),
      TOKEN,
      NOW,
    );

    expect(sentHeaders(fetch).authorization).toBe('Bearer jwt');
    expect(signed).toHaveBeenCalledWith({
      audience: 'https://dba',
      subject: 'hook:workspace_1/team_1/dba-review',
      occurrence: 'occurrence_1',
      message: sentHeaders(fetch)['webhook-id'],
      bodyDigest: createHash('sha256')
        .update(hookRequest().body)
        .digest('base64url'),
    });
  });

  it('reads a deny reason from the answer', async () => {
    const { requests: sending } = requests(
      async () =>
        new Response('{"deny":"drops a column in use"}', { status: 200 }),
    );

    await expect(
      sending.sent(hookRequest(), TOKEN, NOW),
    ).resolves.toMatchObject({
      denyReason: 'drops a column in use',
    });
  });

  it('fails a step answered outside 2xx, saying so', async () => {
    const { requests: sending } = requests(
      async () => new Response('down', { status: 503 }),
    );

    await expect(
      sending.sent(hookRequest(), TOKEN, NOW),
    ).resolves.toMatchObject({
      outcome: {
        status: 'failed',
        code: 'server-error',
        reason: 'was answered 503 by https://dba.example.com/review',
      },
      trace: { status: 503, failed: true },
    });
  });

  it.each([
    [404, 'rejected'],
    [401, 'rejected'],
    [429, 'throttled'],
    [408, 'throttled'],
    [500, 'server-error'],
  ])('types an answer of %i as %s', async (status, code) => {
    const { requests: sending } = requests(
      async () => new Response('no', { status }),
    );

    await expect(
      sending.sent(hookRequest(), TOKEN, NOW),
    ).resolves.toMatchObject({
      outcome: { status: 'failed', code },
    });
  });

  it('names the firing it was sent for, so a reply can carry the chain back', async () => {
    const { fetch, requests: sending } = requests(
      async () => new Response('{}', { status: 200 }),
    );

    await sending.sent(
      hookRequest({
        instance: { ...INSTANCE, firing: HookFiringId.of('firing_1') },
      }),
      TOKEN,
      NOW,
    );

    expect(sentHeaders(fetch)['spotlight-cause']).toBe('firing_1');
  });

  it('sends nothing when a hook that signs with OIDC finds no key to sign with', async () => {
    const { fetch, requests: sending } = requests(
      async () => new Response('{}'),
      network(),
      undefined,
      SECRET,
      unlimited,
      unscoped,
      false,
    );

    await expect(
      sending.sent(
        hookRequest({ signing: { kind: 'oidc', audience: 'https://dba' } }),
        TOKEN,
        NOW,
      ),
    ).resolves.toMatchObject({
      outcome: {
        status: 'failed',
        code: 'not-allowed',
        reason: 'needs a key to sign its OIDC token. This deployment has none',
      },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('names no firing for a hook before an event', async () => {
    const { fetch, requests: sending } = requests(
      async () => new Response('{}', { status: 200 }),
    );

    await sending.sent(hookRequest(), TOKEN, NOW);

    expect(sentHeaders(fetch)['spotlight-cause']).toBeUndefined();
  });

  it('sends nothing when the workspace calls other services too often, and says so', async () => {
    const { requests: sending, fetch } = requests(
      async () => new Response('{}'),
      network(),
      undefined,
      SECRET,
      { perSecond: 50, take: async () => false },
    );

    await expect(
      sending.sent(hookRequest(), TOKEN, NOW),
    ).resolves.toMatchObject({
      outcome: {
        status: 'failed',
        code: 'throttled',
        reason:
          'this workspace sends more than 50 requests each second to other services',
      },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails a step it could not send, saying why', async () => {
    const { requests: sending } = requests(async () => {
      throw Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error(''), { code: 'ECONNREFUSED' }),
      });
    });

    await expect(
      sending.sent(hookRequest(), TOKEN, NOW),
    ).resolves.toMatchObject({
      outcome: {
        status: 'failed',
        code: 'unreachable',
        reason:
          'could not reach https://dba.example.com/review: nothing answered there',
      },
    });
  });

  it('never sends to a host the deployment does not allow', async () => {
    const { fetch, requests: sending } = requests(
      async () => new Response('{}'),
      network(),
      ['slack.com'],
    );

    await expect(
      sending.sent(hookRequest(), TOKEN, NOW),
    ).resolves.toMatchObject({
      outcome: { status: 'failed', code: 'not-allowed' },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never sends to a host the workspace does not allow, and says so', async () => {
    const { fetch, requests: sending } = requests(
      async () => new Response('{}'),
      network(),
      undefined,
      SECRET,
      unlimited,
      scopedTo('slack.com'),
    );

    await expect(
      sending.sent(hookRequest(), TOKEN, NOW),
    ).resolves.toMatchObject({
      outcome: {
        status: 'failed',
        code: 'not-allowed',
        reason:
          "Outbound call to dba.example.com blocked. Host is not on the workspace's allowed list.",
      },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails the step, to try again, when it cannot read the workspace list', async () => {
    const { fetch, requests: sending } = requests(
      async () => new Response('{}'),
      network(),
      undefined,
      SECRET,
      unlimited,
      {
        within: async () => {
          throw new OutboundHostsUnreadError('ws_1', 'connection lost');
        },
        withinFresh: async () => {
          throw new OutboundHostsUnreadError('ws_1', 'connection lost');
        },
      },
    );

    await expect(
      sending.sent(hookRequest(), TOKEN, NOW),
    ).resolves.toMatchObject({
      outcome: {
        status: 'failed',
        code: 'unavailable',
        reason:
          "Spotlight could not read the workspace's allowed hosts: connection lost",
      },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends to a host the workspace allows', async () => {
    const { fetch, requests: sending } = requests(
      async () => new Response('{}'),
      network(),
      undefined,
      SECRET,
      unlimited,
      scopedTo('*.example.com'),
    );

    await sending.sent(hookRequest(), TOKEN, NOW);

    expect(fetch).toHaveBeenCalledOnce();
  });

  it('has a host of the workspace send a request from its network, and waits for it before an event', async () => {
    const {
      fetch,
      calls,
      requests: sending,
    } = requests(async () => new Response('{}'));

    const stepResult = await sending.sent(
      hookRequest({ url: 'http://dba.acme.internal/', fromNetwork: true }),
      TOKEN,
      NOW,
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(calls.queue).toHaveBeenCalledWith(
      'workspace_1',
      expect.objectContaining({
        url: 'http://dba.acme.internal/',
        headers: expect.objectContaining({
          'webhook-signature': expect.stringMatching(/^v1,/),
        }),
      }),
      new Date(NOW.getTime() + 10_000),
    );
    expect(stepResult.outcome).toEqual({
      name: HookStepName.of('check'),
      status: 'done',
      output: { ok: true },
    });
  });

  it('suspends a request a host sends after an event, and resumes it', async () => {
    const calls = network();
    const { requests: sending } = requests(
      async () => new Response('{}'),
      calls,
    );

    const first = await sending.sent(
      hookRequest({ fromNetwork: true, waitMode: 'suspend' }),
      TOKEN,
      NOW,
    );

    expect(first.outcome).toEqual({
      name: HookStepName.of('check'),
      status: 'waiting',
      call: 'call_1',
      until: new Date(NOW.getTime() + 2 * 60 * 1000),
    });
    await expect(
      sending.resumed(
        hookRequest({ fromNetwork: true, waitMode: 'suspend' }),
        first.outcome as WaitingHookStep,
        NOW,
      ),
    ).resolves.toBeNull();

    vi.mocked(calls.stateOf).mockResolvedValueOnce({
      kind: 'answered',
      response: {
        status: 204,
        headers: {},
        body: new Uint8Array(),
        ms: 30,
        error: null,
      },
    });

    await expect(
      sending.resumed(
        hookRequest({ fromNetwork: true, waitMode: 'suspend' }),
        first.outcome as WaitingHookStep,
        NOW,
      ),
    ).resolves.toMatchObject({
      outcome: { status: 'done' },
      trace: { status: 204, ms: 30 },
    });
  });

  it('fails a resumed request whose call ended unanswered', async () => {
    const calls = network();
    vi.mocked(calls.stateOf).mockResolvedValueOnce({
      kind: 'expired',
      claimed: false,
    });
    const { requests: sending } = requests(
      async () => new Response('{}'),
      calls,
    );
    const waiting: WaitingHookStep = {
      name: HookStepName.of('check'),
      status: 'waiting',
      call: 'call_1',
      until: new Date(NOW.getTime() + 60_000),
    };

    await expect(
      sending.resumed(
        hookRequest({ fromNetwork: true, waitMode: 'suspend' }),
        waiting,
        NOW,
      ),
    ).resolves.toMatchObject({
      outcome: {
        status: 'failed',
        reason: expect.stringMatching(/no host of the workspace answered/),
      },
    });
  });

  it('fails a request no host answered in time', async () => {
    const calls = network();
    vi.mocked(calls.answered).mockResolvedValueOnce({
      kind: 'expired',
      claimed: false,
    });
    const { requests: sending } = requests(
      async () => new Response('{}'),
      calls,
    );

    await expect(
      sending.sent(hookRequest({ fromNetwork: true }), TOKEN, NOW),
    ).resolves.toMatchObject({
      outcome: {
        status: 'failed',
        reason: expect.stringMatching(/no host of the workspace answered/),
      },
    });
  });
});
