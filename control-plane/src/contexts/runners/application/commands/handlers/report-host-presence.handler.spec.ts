import { ReportHostPresenceHandler } from '@runners/application/commands/handlers/report-host-presence.handler';
import {
  type ReportedHost,
  ReportHostPresenceCommand,
} from '@runners/application/commands/host.commands';
import type {
  AdmittedHost,
  HostCredential,
  RunnerAdmissionsPort,
} from '@runners/application/ports/runner-admissions.port';
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
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { describe, expect, it, vi } from 'vitest';

const HOST = HOST_ID.value;

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const REPORT: ReportedHost = {
  name: 'build-box',
  release: '0.9.0',
  executor: 'docker',
  capacity: 4,
  running: [],
  images: [
    {
      image: 'ghcr.io/acme/runner:main',
      usual: true,
      harnesses: [{ id: 'claude-code', models: [], version: '2.1.0' }],
    },
  ],
};

const CREDENTIAL: HostCredential = { bearer: 'pool-token', trust: undefined };

const admittedThrough = (way: RunnerPool | RunnerTrust): AdmittedHost => ({
  way: Admission.through(way.id),
  workspaceId: way.workspaceId,
});

const reporting = (
  given: {
    admitted?: RunnerPool | RunnerTrust | null;
    known?: ReturnType<typeof aHost>;
  } = {},
) => {
  const { stored, hosts } = given.known
    ? storedHosts(given.known)
    : storedHosts();
  let now = STARTED_AT;
  let admitted = given.admitted === undefined ? aPullPool() : given.admitted;
  const admit = vi.fn(async () =>
    admitted ? admittedThrough(admitted) : null,
  );

  const handler = new ReportHostPresenceHandler(
    { admit } satisfies RunnerAdmissionsPort,
    hosts,
    { now: () => now } as ClockPort,
  );

  return {
    stored,
    hosts,
    admit,
    at: (ms: number) => {
      now = later(ms);
    },
    admitThrough: (way: RunnerPool | RunnerTrust) => {
      admitted = way;
    },
    report: (
      report: Partial<ReportedHost> = {},
      credential = CREDENTIAL,
      session = 'session_1',
    ) =>
      handler.execute(
        new ReportHostPresenceCommand(credential, HOST, session, {
          ...REPORT,
          ...report,
        }),
      ),
  };
};

describe('ReportHostPresenceHandler', () => {
  it('does not accept a host no pool or trust admits, and keeps nothing of it', async () => {
    const { report, hosts, admit } = reporting({ admitted: null });

    await expect(
      report({}, { bearer: 'stolen', trust: 'trust_1' }),
    ).resolves.toEqual({
      outcome: 'unauthorized',
    });
    expect(admit).toHaveBeenCalledWith({
      bearer: 'stolen',
      trust: 'trust_1',
    });
    expect(hosts.add).not.toHaveBeenCalled();
    expect(hosts.save).not.toHaveBeenCalled();
  });

  it('keeps a host the first time it reports, in the workspace it was admitted to', async () => {
    const { report, stored } = reporting();

    await expect(report()).resolves.toEqual({
      outcome: 'present',
      workspaceId: 'ws_1',
    });

    const host = stored.get(HOST);

    expect(host?.workspaceId.value).toBe('ws_1');
    expect(host?.admission.equals(Admission.through(POOL_ID))).toBe(true);
    expect(host?.firstSeenAt).toEqual(STARTED_AT);
    expect(host?.report.images[0]?.image.value).toBe(
      'ghcr.io/acme/runner:main',
    );
    expect(host?.report.images[0]?.harnesses[0]?.version?.value).toBe('2.1.0');
  });

  it('takes a later report as what the host is now, seen then', async () => {
    const { report, stored, at } = reporting();

    await report();
    at(30_000);
    await report({ running: ['runner_1'] });

    const host = stored.get(HOST);

    expect(host?.firstSeenAt).toEqual(STARTED_AT);
    expect(host?.lastSeenAt).toEqual(later(30_000));
    expect(host?.version).toBe(1);
    expect(host?.report.running.map((each) => each.value)).toEqual([
      'runner_1',
    ]);
  });

  it('keeps a host up since the first report of the session it restarted in', async () => {
    const { report, stored, at } = reporting();

    await report();
    at(30_000);
    await report();

    expect(stored.get(HOST)?.upSince).toEqual(STARTED_AT);

    at(45_000);
    await report({}, CREDENTIAL, 'session_2');

    expect(stored.get(HOST)?.session.value).toBe('session_2');
    expect(stored.get(HOST)?.upSince).toEqual(later(45_000));
  });

  it('does not accept a host that reports through another pool or trust while it still answers through the first', async () => {
    const { report, stored, admitThrough, at } = reporting();

    await report();
    admitThrough(aTrust());
    at(89_999);

    await expect(report()).resolves.toEqual({ outcome: 'taken' });
    expect(stored.get(HOST)?.admission.equals(Admission.through(POOL_ID))).toBe(
      true,
    );
  });

  it('takes over a host id gone silent through another pool or trust', async () => {
    const { report, stored, at } = reporting({
      admitted: aTrust(),
      known: aHost({ through: aPullPool() }),
    });

    at(90_000);

    await expect(report()).resolves.toEqual({
      outcome: 'present',
      workspaceId: 'ws_1',
    });

    const host = stored.get(HOST);

    expect(host?.admission.equals(Admission.through(TRUST_ID))).toBe(true);
    expect(host?.firstSeenAt).toEqual(later(90_000));
    expect(host?.lastSeenAt).toEqual(later(90_000));
  });

  it('rejects a report it cannot read, or one with no session, as invalid', async () => {
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
