import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { HostInUseError } from '@runners/domain/exceptions/host-in-use.error';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const FIRST_HEARTBEAT = new Date('2026-09-24T10:00:00.000Z');

const later = (ms: number): Date => new Date(FIRST_HEARTBEAT.getTime() + ms);

const HOST = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');

const THROUGH_POOL = CredentialSource.of('pool', 'pool_1');

const THROUGH_TRUST = CredentialSource.of('trust', 'trust_1');

const CLAUDE_CODE = { id: 'claude-code', models: [] };

const SERVING = [
  {
    image: 'ghcr.io/usespotlightai/spotlight-runner:1.0.0',
    isDefault: true,
    harnesses: [CLAUDE_CODE],
  },
];

type Images = Parameters<typeof HostReport.of>[0]['images'];

const FIRST_BOOT = BootId.of('boot_1');

const NEXT_BOOT = BootId.of('boot_2');

const reportOf = (running: string[] = [], images: Images = []) =>
  HostReport.of({
    name: 'build-box',
    release: '0.9.0',
    containerRuntime: 'docker',
    capacity: 4,
    running,
    images,
  });

const firstHeartbeat = (images: Images = []) =>
  RunnerHost.fromHeartbeat({
    id: HOST,
    workspaceId: WorkspaceId.of('ws_1'),
    source: THROUGH_POOL,
    bootId: FIRST_BOOT,
    report: reportOf([], images),
    at: FIRST_HEARTBEAT,
  });

const kindsOf = (host: RunnerHost) =>
  host.pullEvents().map((each) => each.kind);

const rehydrated = (
  over: {
    version?: number;
    firstHeartbeatAt?: Date;
    onlineSince?: Date;
    lastHeartbeatAt?: Date;
  } = {},
) =>
  RunnerHost.rehydrate({
    id: HOST,
    workspaceId: WorkspaceId.of('ws_1'),
    source: THROUGH_POOL,
    bootId: FIRST_BOOT,
    report: reportOf(),
    firstHeartbeatAt: over.firstHeartbeatAt ?? FIRST_HEARTBEAT,
    onlineSince: over.onlineSince ?? over.firstHeartbeatAt ?? FIRST_HEARTBEAT,
    lastHeartbeatAt: over.lastHeartbeatAt ?? FIRST_HEARTBEAT,
    version: over.version ?? 3,
  });

const reportedThrough = (
  host: RunnerHost,
  source: CredentialSource,
  at: Date,
  running: string[] = [],
  workspaceId = WorkspaceId.of('ws_1'),
  images: Images = [],
) =>
  host.reportThrough({
    source,
    workspaceId,
    bootId: FIRST_BOOT,
    report: reportOf(running, images),
    at,
  });

const reportedIn = (host: RunnerHost, bootId: BootId, at: Date) =>
  host.reportThrough({
    source: THROUGH_POOL,
    workspaceId: WorkspaceId.of('ws_1'),
    bootId,
    report: reportOf(),
    at,
  });

const reportedServing = (
  host: RunnerHost,
  source: CredentialSource,
  at: Date,
) => reportedThrough(host, source, at, [], WorkspaceId.of('ws_1'), SERVING);

describe('RunnerHost', () => {
  it('has its first and last heartbeat when it first reports, at its first version', () => {
    const host = firstHeartbeat();

    expect(host.firstHeartbeatAt).toEqual(FIRST_HEARTBEAT);
    expect(host.lastHeartbeatAt).toEqual(FIRST_HEARTBEAT);
    expect(host.report.name).toBe('build-box');
    expect(host.version).toBe(0);
  });

  it('takes each later report through the same way whole, as its last heartbeat', () => {
    const reported = reportedThrough(
      firstHeartbeat(),
      THROUGH_POOL,
      later(30_000),
      ['runner_1'],
    );

    expect(reported.report.running.map((each) => each.value)).toEqual([
      'runner_1',
    ]);
    expect(reported.firstHeartbeatAt).toEqual(FIRST_HEARTBEAT);
    expect(reported.lastHeartbeatAt).toEqual(later(30_000));
    expect(reported.servesThrough(THROUGH_POOL)).toBe(true);
  });

  it('is online since it first reports', () => {
    expect(firstHeartbeat().onlineSince).toEqual(FIRST_HEARTBEAT);
  });

  it('stays online since then while the same boot keeps sending heartbeats', () => {
    const reported = reportedThrough(
      reportedThrough(firstHeartbeat(), THROUGH_POOL, later(60_000)),
      THROUGH_POOL,
      later(120_000),
    );

    expect(reported.onlineSince).toEqual(FIRST_HEARTBEAT);
  });

  it('is online again from a report with a new boot id, however soon it comes', () => {
    const restarted = reportedIn(firstHeartbeat(), NEXT_BOOT, later(5_000));

    expect(restarted.bootId).toEqual(NEXT_BOOT);
    expect(restarted.onlineSince).toEqual(later(5_000));
    expect(restarted.firstHeartbeatAt).toEqual(FIRST_HEARTBEAT);
  });

  it('is online again when it sends a heartbeat after it was offline', () => {
    const back = reportedThrough(
      firstHeartbeat(),
      THROUGH_POOL,
      later(10 * 60_000),
    );

    expect(back.onlineSince).toEqual(later(10 * 60_000));
  });

  it('stays online since its restart when the boot before it reports late', () => {
    const late = reportedIn(
      reportedIn(firstHeartbeat(), NEXT_BOOT, later(30_000)),
      FIRST_BOOT,
      later(10_000),
    );

    expect(late.bootId).toEqual(NEXT_BOOT);
    expect(late.onlineSince).toEqual(later(30_000));
    expect(reportedIn(late, NEXT_BOOT, later(60_000)).onlineSince).toEqual(
      later(30_000),
    );
  });

  it('keeps the newer report over one that arrives late', () => {
    const reported = reportedThrough(
      reportedThrough(firstHeartbeat(), THROUGH_POOL, later(30_000), [
        'runner_1',
      ]),
      THROUGH_POOL,
      later(10_000),
    );

    expect(reported.lastHeartbeatAt).toEqual(later(30_000));
    expect(reported.report.running).toHaveLength(1);
  });

  it('ignores a late report, even from a new boot id', () => {
    const late = reportedIn(
      reportedThrough(firstHeartbeat(), THROUGH_POOL, later(30_000)),
      NEXT_BOOT,
      later(10_000),
    );

    expect(late.bootId).toEqual(FIRST_BOOT);
    expect(late.onlineSince).toEqual(FIRST_HEARTBEAT);
  });

  it('takes nothing from a report no later than the last, so there is nothing to save', () => {
    const reported = reportedThrough(
      firstHeartbeat(),
      THROUGH_POOL,
      later(30_000),
    );

    expect(reportedIn(reported, NEXT_BOOT, later(30_000))).toBe(reported);
    expect(reportedIn(reported, NEXT_BOOT, later(10_000))).toBe(reported);
  });

  it('carries the version it was read at through a report', () => {
    expect(
      reportedThrough(rehydrated(), THROUGH_POOL, later(30_000)).version,
    ).toBe(3);
    expect(
      reportedThrough(rehydrated(), THROUGH_TRUST, later(90_000)).version,
    ).toBe(3);
  });

  it('is in use while it is still online through another pool or trust', () => {
    expect(() =>
      reportedThrough(firstHeartbeat(), THROUGH_TRUST, later(89_999)),
    ).toThrow(HostInUseError);
  });

  it('is re-homed through another pool or trust of its workspace once it is offline there', () => {
    const rehomed = reportedThrough(
      firstHeartbeat(),
      THROUGH_TRUST,
      later(90_000),
      ['runner_1'],
    );

    expect(rehomed.servesThrough(THROUGH_TRUST)).toBe(true);
    expect(rehomed.servesThrough(THROUGH_POOL)).toBe(false);
    expect(rehomed.workspaceId.value).toBe('ws_1');
    expect(rehomed.firstHeartbeatAt).toEqual(later(90_000));
    expect(rehomed.onlineSince).toEqual(later(90_000));
    expect(rehomed.lastHeartbeatAt).toEqual(later(90_000));
    expect(rehomed.report.running).toHaveLength(1);
  });

  it('is never moved into another workspace, however long it has been offline', () => {
    expect(() =>
      reportedThrough(
        firstHeartbeat(),
        THROUGH_TRUST,
        later(24 * 3_600_000),
        [],
        WorkspaceId.of('ws_2'),
      ),
    ).toThrow(HostInUseError);
  });

  it('is online for a minute and a half after it last reported', () => {
    const host = firstHeartbeat();

    expect(host.isOnlineAt(later(89_999))).toBe(true);
    expect(host.isOnlineAt(later(90_000))).toBe(false);
    expect(
      reportedThrough(host, THROUGH_POOL, later(60_000)).isOnlineAt(
        later(120_000),
      ),
    ).toBe(true);
  });

  it('becomes stale a day after it last reported', () => {
    const DAY = 24 * 60 * 60_000;

    expect(RunnerHost.staleBefore(later(DAY))).toEqual(FIRST_HEARTBEAT);
  });

  it('tells whether a host with its last heartbeat at a moment is online now, by the same rule as a stored host', () => {
    expect(RunnerHost.isOnline(FIRST_HEARTBEAT, later(89_999))).toBe(true);
    expect(RunnerHost.isOnline(FIRST_HEARTBEAT, later(90_000))).toBe(false);
  });

  it('serves only through the pool or trust it first came in through', () => {
    const host = firstHeartbeat();

    expect(host.servesThrough(CredentialSource.of('pool', 'pool_1'))).toBe(
      true,
    );
    expect(host.servesThrough(CredentialSource.of('pool', 'pool_2'))).toBe(
      false,
    );
    expect(host.servesThrough(CredentialSource.of('trust', 'pool_1'))).toBe(
      false,
    );
  });

  it('starts serving when it first reports an image with a harness', () => {
    const host = firstHeartbeat(SERVING);

    expect(host.servesAHarness).toBe(true);
    expect(kindsOf(host)).toEqual(['runner-host.started-serving']);
  });

  it('does not serve on a report with no image, an unavailable image or an image without a harness', () => {
    for (const images of [
      [],
      [{ ...SERVING[0], unavailableReason: 'pull access denied' }],
      [{ ...SERVING[0], harnesses: [] }],
    ] as Images[]) {
      const host = firstHeartbeat(images);

      expect(host.servesAHarness).toBe(false);
      expect(kindsOf(host)).toEqual([]);
    }
  });

  it('starts serving on the first later report that offers a harness', () => {
    const host = firstHeartbeat();
    kindsOf(host);

    expect(kindsOf(reportedServing(host, THROUGH_POOL, later(30_000)))).toEqual(
      ['runner-host.started-serving'],
    );
  });

  it('does not start serving again while it keeps serving', () => {
    const host = firstHeartbeat(SERVING);
    kindsOf(host);

    expect(kindsOf(reportedServing(host, THROUGH_POOL, later(30_000)))).toEqual(
      [],
    );
  });

  it('starts serving again once re-homed through another pool or trust', () => {
    const host = firstHeartbeat(SERVING);
    kindsOf(host);

    expect(
      kindsOf(reportedServing(host, THROUGH_TRUST, later(90_000))),
    ).toEqual(['runner-host.started-serving']);
  });

  it('is not read back with its last heartbeat before its first heartbeat', () => {
    expect(() => rehydrated({ firstHeartbeatAt: later(1) })).toThrow(
      InconsistentStateError,
    );
  });

  it('is not read back online since before its first heartbeat or after its last heartbeat', () => {
    expect(() =>
      rehydrated({ onlineSince: later(-1), lastHeartbeatAt: later(60_000) }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      rehydrated({
        onlineSince: later(60_001),
        lastHeartbeatAt: later(60_000),
      }),
    ).toThrow(InconsistentStateError);
    expect(
      rehydrated({ onlineSince: later(60_000), lastHeartbeatAt: later(60_000) })
        .onlineSince,
    ).toEqual(later(60_000));
  });

  it('is not read back at an impossible version', () => {
    for (const version of [-1, 1.5]) {
      expect(() => rehydrated({ version })).toThrow(InconsistentStateError);
    }
  });
});
