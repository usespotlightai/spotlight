import { HostHeartbeatHandler } from '@runners/application/commands/handlers/host-heartbeat.handler';
import {
  HostHeartbeatCommand,
  type ReportedHost,
} from '@runners/application/commands/host.commands';
import type {
  AuthenticatedHost,
  HostCredentials,
  RunnerAuthenticatorPort,
} from '@runners/application/ports/runner-authenticator.port';
import { Sandboxes } from '@runners/application/services/sandboxes.service';
import type { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import {
  aHost,
  aPullPool,
  aTrust,
  HOST_ID,
  POOL_ID,
  STARTED_AT,
  storedHosts,
  TRUST_ID,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import type { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import {
  aSandbox,
  DRAIN_POLICY,
  storedSandboxes,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const HOST = HOST_ID.value;

const WORKSPACE = WorkspaceId.of('ws_1');

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const REPORT: ReportedHost = {
  name: 'build-box',
  release: '0.9.0',
  containerRuntime: 'docker',
  capacity: 4,
  running: [],
  images: [
    {
      image: 'ghcr.io/acme/runner:main',
      isDefault: true,
      harnesses: [{ id: 'claude-code', models: [], version: '2.1.0' }],
    },
  ],
};

const CREDENTIAL: HostCredentials = { bearer: 'pool-token', trust: undefined };

const authenticatedThrough = (
  holder: RunnerPool | RunnerTrust,
): AuthenticatedHost => ({
  source: CredentialSource.ofId(holder.id),
  workspaceId: holder.workspaceId,
});

const reporting = (
  input: {
    authenticated?: RunnerPool | RunnerTrust | null;
    known?: ReturnType<typeof aHost>;
    sandboxes?: Sandbox[];
  } = {},
) => {
  const placed = storedSandboxes({}, ...(input.sandboxes ?? []));
  const { stored, hosts } = input.known
    ? storedHosts(input.known)
    : storedHosts();
  let now = STARTED_AT;
  let authenticated =
    input.authenticated === undefined ? aPullPool() : input.authenticated;
  const authenticate = vi.fn(async () =>
    authenticated ? authenticatedThrough(authenticated) : null,
  );

  const handler = new HostHeartbeatHandler(
    { authenticate } satisfies RunnerAuthenticatorPort,
    hosts,
    new Sandboxes(
      placed.sandboxes,
      DRAIN_POLICY,
      { generate: () => 'sandbox_new' },
      {
        inTransaction: (work: () => Promise<unknown>) => work(),
      } as TransactionPort,
      { info: vi.fn() } as unknown as LoggerPort,
    ),
    { now: () => now } as ClockPort,
  );

  return {
    stored,
    hosts,
    placed: placed.stored,
    authenticate,
    at: (ms: number) => {
      now = later(ms);
    },
    authenticateThrough: (holder: RunnerPool | RunnerTrust) => {
      authenticated = holder;
    },
    report: (
      report: Partial<ReportedHost> = {},
      credential = CREDENTIAL,
      bootId = 'boot_1',
      sandboxes: string[] = [],
      stopping = false,
    ) =>
      handler.execute(
        new HostHeartbeatCommand(
          credential,
          HOST,
          bootId,
          { ...REPORT, ...report },
          sandboxes,
          stopping,
        ),
      ),
  };
};

describe('HostHeartbeatHandler', () => {
  it('does not accept a host no pool or trust accepts, and stores nothing of it', async () => {
    const { report, hosts, authenticate } = reporting({ authenticated: null });

    await expect(
      report({}, { bearer: 'stolen', trust: 'trust_1' }),
    ).resolves.toEqual({
      outcome: 'unauthorized',
    });
    expect(authenticate).toHaveBeenCalledWith({
      bearer: 'stolen',
      trust: 'trust_1',
    });
    expect(hosts.add).not.toHaveBeenCalled();
    expect(hosts.save).not.toHaveBeenCalled();
  });

  it('stores a host the first time it reports, in the workspace it authenticated to', async () => {
    const { report, stored } = reporting();

    await expect(report()).resolves.toEqual({
      outcome: 'accepted',
      workspaceId: 'ws_1',
      drain: [],
    });

    const host = stored.get(HOST);

    expect(host?.workspaceId.value).toBe('ws_1');
    expect(host?.source.equals(CredentialSource.ofId(POOL_ID))).toBe(true);
    expect(host?.firstHeartbeatAt).toEqual(STARTED_AT);
    expect(host?.report.images[0]?.image.value).toBe(
      'ghcr.io/acme/runner:main',
    );
    expect(host?.report.images[0]?.harnesses[0]?.version?.value).toBe('2.1.0');
  });

  it('takes a later heartbeat as what the host is now, at that time', async () => {
    const { report, stored, at } = reporting();

    await report();
    at(30_000);
    await report({ running: ['runner_1'] });

    const host = stored.get(HOST);

    expect(host?.firstHeartbeatAt).toEqual(STARTED_AT);
    expect(host?.lastHeartbeatAt).toEqual(later(30_000));
    expect(host?.version).toBe(1);
    expect(host?.report.running.map((each) => each.value)).toEqual([
      'runner_1',
    ]);
  });

  it('keeps a host online since the first heartbeat of the boot it restarted in', async () => {
    const { report, stored, at } = reporting();

    await report();
    at(30_000);
    await report();

    expect(stored.get(HOST)?.onlineSince).toEqual(STARTED_AT);

    at(45_000);
    await report({}, CREDENTIAL, 'boot_2');

    expect(stored.get(HOST)?.bootId.value).toBe('boot_2');
    expect(stored.get(HOST)?.onlineSince).toEqual(later(45_000));
  });

  it('does not accept a host that reports through another pool or trust while it is still online through the first', async () => {
    const { report, stored, authenticateThrough, at } = reporting();

    await report();
    authenticateThrough(aTrust());
    at(89_999);

    await expect(report()).resolves.toEqual({ outcome: 'host-in-use' });
    expect(
      stored.get(HOST)?.source.equals(CredentialSource.ofId(POOL_ID)),
    ).toBe(true);
  });

  it('takes over a host id that is offline through another pool or trust', async () => {
    const { report, stored, at } = reporting({
      authenticated: aTrust(),
      known: aHost({ through: aPullPool() }),
    });

    at(90_000);

    await expect(report()).resolves.toEqual({
      outcome: 'accepted',
      workspaceId: 'ws_1',
      drain: [],
    });

    const host = stored.get(HOST);

    expect(host?.source.equals(CredentialSource.ofId(TRUST_ID))).toBe(true);
    expect(host?.firstHeartbeatAt).toEqual(later(90_000));
    expect(host?.lastHeartbeatAt).toEqual(later(90_000));
  });

  it('answers which reported sandboxes to drain, and keeps the state of those it reports', async () => {
    const { report, placed, at } = reporting({
      sandboxes: [
        aSandbox({
          id: 'sandbox_1',
          workspaceId: WORKSPACE,
          hostId: HOST_ID,
          at: STARTED_AT,
        }),
        aSandbox({
          id: 'sandbox_2',
          key: 'chat-chat_1',
          workspaceId: WORKSPACE,
          hostId: HOST_ID,
          at: STARTED_AT,
        })
          .reported()
          .drain(),
      ],
    });

    at(20_000);

    await expect(
      report({}, CREDENTIAL, 'boot_1', ['sandbox_1', 'sandbox_2', 'sandbox_9']),
    ).resolves.toEqual({
      outcome: 'accepted',
      workspaceId: 'ws_1',
      drain: ['sandbox_2', 'sandbox_9'],
    });
    expect(placed.get('sandbox_1')?.current).toBe('ready');

    at(40_000);
    await report({}, CREDENTIAL, 'boot_1', ['sandbox_1']);

    expect(placed.get('sandbox_2')?.current).toBe('gone');
  });

  it('does not touch sandboxes when it does not accept the host', async () => {
    const { report, placed } = reporting({
      authenticated: null,
      sandboxes: [
        aSandbox({
          id: 'sandbox_1',
          workspaceId: WORKSPACE,
          hostId: HOST_ID,
          at: STARTED_AT,
        }).reported(),
      ],
    });

    await report();

    expect(placed.get('sandbox_1')?.current).toBe('ready');
  });

  it('rejects a heartbeat it cannot read, or one with no boot id, as invalid', async () => {
    const { report, hosts } = reporting();

    await expect(report({ capacity: 0 })).rejects.toThrow(ApplicationError);
    await expect(report({ capacity: 0 })).rejects.toMatchObject({
      kind: 'invalid',
    });
    await expect(report({}, CREDENTIAL, '  ')).rejects.toMatchObject({
      kind: 'invalid',
    });
    expect(hosts.add).not.toHaveBeenCalled();
    expect(hosts.save).not.toHaveBeenCalled();
  });
});
