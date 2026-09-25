import { createHmac } from 'node:crypto';
import { OutboundHosts } from '@platform/outbound/outbound-hosts';
import type { ProvisionCall } from '@runners/application/ports/provision-calls.port';
import { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import {
  SignedProvisionCalls,
  signatureOf,
} from '@runners/infrastructure/provision/signed-provision-calls';
import { describe, expect, it, vi } from 'vitest';

const SECRET = ProvisionSecret.of(
  `whsec_${Buffer.from('k'.repeat(32)).toString('base64')}`,
);

const AT = new Date('2026-09-24T10:00:00.000Z');

const calling = (
  url = 'https://provision.example.com/runs',
): ProvisionCall => ({
  url: ProvisionUrl.of(url),
  secret: SECRET,
  attempt: 'runner_1',
  at: AT,
  pool: 'sandboxes',
  workspaceId: 'ws_1',
  kind: 'run',
  stackId: null,
  runId: 'run_1',
  taskId: 'task_1',
  labels: ['sandbox'],
  image: 'ghcr.io/acme/widgets:1',
  runnerId: 'runner_1',
  token: 'one-run-token',
  claimBy: new Date('2026-09-24T10:05:00.000Z'),
});

const calls = (
  answer: () => Promise<Response>,
  settings: { hosts?: string[]; insecureAllowed?: boolean } = {},
) => {
  const fetch = vi.fn(answer);

  return {
    fetch,
    provision: new SignedProvisionCalls(
      {
        spotlightUrl: 'https://app.usespotlight.ai',
        hosts: new OutboundHosts(settings.hosts ?? ['example.com']),
        insecureAllowed: settings.insecureAllowed ?? false,
      },
      fetch as unknown as typeof globalThis.fetch,
    ),
  };
};

describe('signatureOf', () => {
  it('signs as the Standard Webhooks specification does', () => {
    expect(
      signatureOf(
        Buffer.from('MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw', 'base64'),
        'msg_p5jXN8AQM9LWM0D4loKWxJek',
        1614265330,
        '{"test": 2432232314}',
      ),
    ).toBe('v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=');
  });
});

describe('SignedProvisionCalls', () => {
  it('posts the run, its labels, its image and a one-run token, signed with the pool secret', async () => {
    const { fetch, provision } = calls(
      async () => new Response(null, { status: 202 }),
    );

    await expect(provision.call(calling())).resolves.toEqual({
      outcome: 'accepted',
    });

    const [url, sent] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit & { headers: Record<string, string>; body: string },
    ];
    const signed = `${sent.headers['webhook-id']}.${sent.headers['webhook-timestamp']}.${sent.body}`;

    expect(url).toBe('https://provision.example.com/runs');
    expect(sent.headers['webhook-signature']).toBe(
      `v1,${createHmac('sha256', SECRET.key).update(signed).digest('base64')}`,
    );
    expect(JSON.parse(sent.body)).toEqual({
      type: 'work.provision',
      timestamp: '2026-09-24T10:00:00.000Z',
      data: {
        kind: 'run',
        runId: 'run_1',
        stackId: null,
        taskId: 'task_1',
        workspaceId: 'ws_1',
        pool: 'sandboxes',
        labels: ['sandbox'],
        image: 'ghcr.io/acme/widgets:1',
        runner: { id: 'runner_1', token: 'one-run-token' },
        spotlightUrl: 'https://app.usespotlight.ai',
        claimBy: '2026-09-24T10:05:00.000Z',
      },
    });
  });

  it('names the change stack when the runner is wanted for a check', async () => {
    const { fetch, provision } = calls(
      async () => new Response(null, { status: 202 }),
    );

    await provision.call({
      ...calling(),
      kind: 'check',
      stackId: 'stack_1',
      taskId: null,
    });

    const [, sent] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit & { body: string },
    ];

    expect(JSON.parse(sent.body).data).toMatchObject({
      kind: 'check',
      stackId: 'stack_1',
      runId: 'run_1',
      taskId: null,
    });
  });

  it('names no image when the work asks for the usual one', async () => {
    const { fetch, provision } = calls(
      async () => new Response(null, { status: 202 }),
    );

    await provision.call({ ...calling(), image: null });

    const [, sent] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit & { body: string },
    ];

    expect(JSON.parse(sent.body).data.image).toBeNull();
  });

  it('says what the endpoint answered when it refuses', async () => {
    const { provision } = calls(
      async () => new Response('no capacity', { status: 503 }),
    );

    await expect(provision.call(calling())).resolves.toEqual({
      outcome: 'refused',
      detail: 'answered 503: no capacity',
    });
  });

  it('says the endpoint could not be reached', async () => {
    const { provision } = calls(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(provision.call(calling())).resolves.toMatchObject({
      outcome: 'unreachable',
      detail: 'fetch failed',
    });
  });

  it('calls no host the deployment does not allow', async () => {
    const { fetch, provision } = calls(async () => new Response(null));

    await expect(
      provision.call(calling('https://elsewhere.test/runs')),
    ).resolves.toMatchObject({ outcome: 'not-allowed' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never sends a token in the clear unless the deployment allows it', async () => {
    const refusing = calls(async () => new Response(null));
    const allowing = calls(async () => new Response(null), {
      insecureAllowed: true,
    });

    await expect(
      refusing.provision.call(calling('http://provision.example.com/runs')),
    ).resolves.toMatchObject({ outcome: 'not-allowed' });
    await expect(
      allowing.provision.call(calling('http://provision.example.com/runs')),
    ).resolves.toEqual({ outcome: 'accepted' });
  });
});
