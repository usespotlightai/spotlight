import { createHmac } from 'node:crypto';
import { OutboundHosts } from '@platform/outbound/outbound-hosts';
import type { ProvisionCall } from '@runners/application/ports/provision-calls.port';
import { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { SignedProvisionCalls } from '@runners/infrastructure/provision/signed-provision-calls';
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
  messageId: 'runner_1',
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
  egress: null,
});

const calls = (
  answer: () => Promise<Response>,
  settings: { hosts?: string[] } = {},
) => {
  const fetch = vi.fn(answer);

  return {
    fetch,
    provision: new SignedProvisionCalls(
      {
        spotlightUrl: 'https://app.usespotlight.ai',
        hosts: new OutboundHosts(settings.hosts ?? ['example.com']),
      },
      fetch as unknown as typeof globalThis.fetch,
    ),
  };
};

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
        runner: { id: 'runner_1', token: 'one-run-token', egress: null },
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

  it('names no image when the work requests the default one', async () => {
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

  it('gives the runner the egress to go out through and its proxy credential', async () => {
    const { fetch, provision } = calls(
      async () => new Response(null, { status: 202 }),
    );

    await provision.call({
      ...calling(),
      egress: {
        url: 'https://egress.example.com',
        credential: 'proxy-credential',
        traffic: 'bound',
      },
    });

    const [, sent] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit & { body: string },
    ];

    expect(JSON.parse(sent.body).data.runner).toEqual({
      id: 'runner_1',
      token: 'one-run-token',
      egress: {
        url: 'https://egress.example.com',
        credential: 'proxy-credential',
        traffic: 'bound',
      },
    });
  });

  it('says what the endpoint answered when it fails', async () => {
    const { provision } = calls(
      async () => new Response('no capacity', { status: 503 }),
    );

    await expect(provision.call(calling())).resolves.toEqual({
      outcome: 'http-error',
      detail: 'Provision URL answered 503. Response: no capacity',
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
});
