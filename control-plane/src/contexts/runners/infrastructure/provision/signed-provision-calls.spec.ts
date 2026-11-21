import { createHmac } from 'node:crypto';

import { scopedTo } from '@identity/application/ports/workspace-outbound-scope.fake-spec';
import { OutboundGuard } from '@platform/outbound/outbound-guard';
import type { ProvisionCall } from '@runners/application/ports/provision-calls.port';
import { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { SignedProvisionCalls } from '@runners/infrastructure/provision/signed-provision-calls';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import { describe, expect, it, vi } from 'vitest';

const SECRET = ProvisionSecret.of(
  `whsec_${Buffer.from('k'.repeat(32)).toString('base64')}`,
);

const AT = new Date('2026-09-24T10:00:00.000Z');

const calling = (
  url = 'https://provision.example.com/runs',
  scope: ProvisionCall['scope'] = 'workspace',
): ProvisionCall => ({
  scope,
  url: ProvisionUrl.of(url),
  secret: SECRET,
  messageId: 'runner_1',
  at: AT,
  pool: 'sandboxes',
  workspaceId: 'ws_1',
  work: { kind: 'run', runId: 'run_1' },
  tags: { taskId: 'task_1' },
  labels: ['sandbox'],
  image: 'ghcr.io/acme/widgets:1',
  runnerId: 'runner_1',
  token: 'one-run-token',
  claimBy: new Date('2026-09-24T10:05:00.000Z'),
  egress: null,
});

const sentData = (sent: { body: string }) =>
  (JSON.parse(sent.body) as { data: Record<string, unknown> }).data;

const calls = (
  answer: () => Promise<Response>,
  settings: { hosts?: string[]; workspaceHosts?: string[] } = {},
) => {
  const fetch = vi.fn(answer);

  return {
    fetch,
    provision: new SignedProvisionCalls(
      {
        spotlightUrl: 'https://app.usespotlight.ai',
        guard: new OutboundGuard(
          HostAllowList.listed(
            (settings.hosts ?? ['example.com', '*.example.com']).join(','),
          ),
        ),
        scope: scopedTo(...(settings.workspaceHosts ?? [])),
      },
      fetch,
    ),
  };
};

describe('SignedProvisionCalls', () => {
  it('posts nothing to a host the workspace does not allow, and says so', async () => {
    const { fetch, provision } = calls(
      async () => new Response(null, { status: 202 }),
      { workspaceHosts: ['hooks.example.com'] },
    );

    await expect(provision.call(calling())).resolves.toEqual({
      outcome: 'not-allowed',
      detail:
        'This workspace’s outbound allow-list doesn’t include provision.example.com.',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts a call to the managed provisioner under the deployment’s allow-list only', async () => {
    const { fetch, provision } = calls(
      async () => new Response(null, { status: 202 }),
      { workspaceHosts: ['hooks.example.com'] },
    );

    await expect(
      provision.call(calling(undefined, 'deployment')),
    ).resolves.toEqual({ outcome: 'accepted' });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('posts nothing to a managed provisioner that the deployment does not allow', async () => {
    const { fetch, provision } = calls(
      async () => new Response(null, { status: 202 }),
      { hosts: ['hooks.example.com'] },
    );

    await expect(
      provision.call(calling(undefined, 'deployment')),
    ).resolves.toEqual({
      outcome: 'not-allowed',
      detail:
        'This deployment’s outbound allow-list doesn’t include provision.example.com.',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

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
      `v1,${createHmac('sha256', Buffer.from(SECRET.encodedKey, 'base64')).update(signed).digest('base64')}`,
    );
    expect(JSON.parse(sent.body)).toEqual({
      type: 'work.provision',
      timestamp: '2026-09-24T10:00:00.000Z',
      data: {
        kind: 'run',
        runId: 'run_1',
        stackId: null,
        diffId: null,
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
      work: { kind: 'check', stackId: 'stack_1', runId: 'run_1' },
      tags: {},
    });

    const [, sent] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit & { body: string },
    ];

    expect(sentData(sent)).toMatchObject({
      kind: 'check',
      stackId: 'stack_1',
      diffId: null,
      runId: 'run_1',
    });
    expect(sentData(sent)).not.toHaveProperty('taskId');
  });

  it('names no run when the runner is wanted for work of no run', async () => {
    const { fetch, provision } = calls(
      async () => new Response(null, { status: 202 }),
    );

    await provision.call({
      ...calling(),
      work: { kind: 'diff', diffId: 'diff_1' },
      tags: {},
    });

    const [, sent] = fetch.mock.calls[0] as unknown as [
      string,
      RequestInit & { body: string },
    ];

    expect(sentData(sent)).toMatchObject({
      kind: 'diff',
      stackId: null,
      diffId: 'diff_1',
      runId: null,
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

    expect(sentData(sent).image).toBeNull();
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

    expect(sentData(sent).runner).toEqual({
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

  it('passes on the reason when the pool declines the work', async () => {
    const { provision } = calls(async () =>
      Response.json(
        {
          type: 'work.declined',
          reason: '  This workspace has used its free run-hours.  ',
        },
        { status: 422 },
      ),
    );

    await expect(provision.call(calling())).resolves.toEqual({
      outcome: 'declined',
      detail: 'This workspace has used its free run-hours.',
    });
  });

  it('keeps at most 500 characters of a reason', async () => {
    const { provision } = calls(async () =>
      Response.json(
        { type: 'work.declined', reason: 'x'.repeat(600) },
        { status: 422 },
      ),
    );

    await expect(provision.call(calling())).resolves.toEqual({
      outcome: 'declined',
      detail: 'x'.repeat(500),
    });
  });

  it.each([
    ['no JSON', 'unprocessable'],
    ['another type', JSON.stringify({ type: 'other', reason: 'no' })],
    ['no reason', JSON.stringify({ type: 'work.declined' })],
    ['an empty reason', JSON.stringify({ type: 'work.declined', reason: ' ' })],
  ])('takes a 422 with %s as an HTTP error', async (_, body) => {
    const { provision } = calls(
      async () => new Response(body, { status: 422 }),
    );

    await expect(provision.call(calling())).resolves.toMatchObject({
      outcome: 'http-error',
    });
  });

  it('takes a decline body with another status as an HTTP error', async () => {
    const { provision } = calls(async () =>
      Response.json({ type: 'work.declined', reason: 'No.' }, { status: 403 }),
    );

    await expect(provision.call(calling())).resolves.toMatchObject({
      outcome: 'http-error',
    });
  });

  it('takes the pool as full when the provision URL answers 429', async () => {
    const { provision } = calls(
      async () => new Response('slow down', { status: 429 }),
    );

    await expect(provision.call(calling())).resolves.toEqual({
      outcome: 'full',
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
