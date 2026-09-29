import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { HostTakenError } from '@runners/domain/exceptions/host-taken.error';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const FIRST_SEEN = new Date('2026-09-24T10:00:00.000Z');

const later = (ms: number): Date => new Date(FIRST_SEEN.getTime() + ms);

const HOST = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');

const THROUGH_POOL = Admission.of('pool', 'pool_1');

const THROUGH_TRUST = Admission.of('trust', 'trust_1');

const CLAUDE_CODE = { id: 'claude-code', models: [] };

const SERVING = [
  {
    image: 'ghcr.io/usespotlightai/spotlight-runner:1.0.0',
    usual: true,
    harnesses: [CLAUDE_CODE],
  },
];

type Images = Parameters<typeof HostReport.of>[0]['images'];

const reportOf = (running: string[] = [], images: Images = []) =>
  HostReport.of({
    name: 'build-box',
    release: '0.9.0',
    executor: 'docker',
    capacity: 4,
    running,
    images,
  });

const present = (images: Images = []) =>
  RunnerHost.present({
    id: HOST,
    workspaceId: WorkspaceId.of('ws_1'),
    admission: THROUGH_POOL,
    report: reportOf([], images),
    at: FIRST_SEEN,
  });

const kindsOf = (host: RunnerHost) =>
  host.pullEvents().map((each) => each.kind);

const rehydrated = (over: { version?: number; firstSeenAt?: Date } = {}) =>
  RunnerHost.rehydrate({
    id: HOST,
    workspaceId: WorkspaceId.of('ws_1'),
    admission: THROUGH_POOL,
    report: reportOf(),
    firstSeenAt: over.firstSeenAt ?? FIRST_SEEN,
    lastSeenAt: FIRST_SEEN,
    version: over.version ?? 3,
  });

const reportedThrough = (
  host: RunnerHost,
  admission: Admission,
  at: Date,
  running: string[] = [],
  workspaceId = WorkspaceId.of('ws_1'),
  images: Images = [],
) =>
  host.reportedThrough({
    admission,
    workspaceId,
    report: reportOf(running, images),
    at,
  });

const reportedServing = (host: RunnerHost, admission: Admission, at: Date) =>
  reportedThrough(host, admission, at, [], WorkspaceId.of('ws_1'), SERVING);

describe('RunnerHost', () => {
  it('is first and last seen when it first reports, at its first version', () => {
    const host = present();

    expect(host.firstSeenAt).toEqual(FIRST_SEEN);
    expect(host.lastSeenAt).toEqual(FIRST_SEEN);
    expect(host.report.name).toBe('build-box');
    expect(host.version).toBe(0);
  });

  it('takes each later report through the same way whole, as last seen then', () => {
    const reported = reportedThrough(present(), THROUGH_POOL, later(30_000), [
      'runner_1',
    ]);

    expect(reported.report.running.map((each) => each.value)).toEqual([
      'runner_1',
    ]);
    expect(reported.firstSeenAt).toEqual(FIRST_SEEN);
    expect(reported.lastSeenAt).toEqual(later(30_000));
    expect(reported.servesThrough(THROUGH_POOL)).toBe(true);
  });

  it('never goes back to having been seen earlier on a report that arrives late', () => {
    const reported = reportedThrough(
      reportedThrough(present(), THROUGH_POOL, later(30_000)),
      THROUGH_POOL,
      later(10_000),
      ['runner_1'],
    );

    expect(reported.lastSeenAt).toEqual(later(30_000));
    expect(reported.report.running).toHaveLength(1);
  });

  it('carries the version it was read at through a report', () => {
    expect(
      reportedThrough(rehydrated(), THROUGH_POOL, later(30_000)).version,
    ).toBe(3);
    expect(
      reportedThrough(rehydrated(), THROUGH_TRUST, later(90_000)).version,
    ).toBe(3);
  });

  it('is taken while it still answers through another way in', () => {
    expect(() =>
      reportedThrough(present(), THROUGH_TRUST, later(89_999)),
    ).toThrow(HostTakenError);
  });

  it('is re-homed through another way in of its workspace once it has gone silent there', () => {
    const rehomed = reportedThrough(present(), THROUGH_TRUST, later(90_000), [
      'runner_1',
    ]);

    expect(rehomed.servesThrough(THROUGH_TRUST)).toBe(true);
    expect(rehomed.servesThrough(THROUGH_POOL)).toBe(false);
    expect(rehomed.workspaceId.value).toBe('ws_1');
    expect(rehomed.firstSeenAt).toEqual(later(90_000));
    expect(rehomed.lastSeenAt).toEqual(later(90_000));
    expect(rehomed.report.running).toHaveLength(1);
  });

  it('is never taken into another workspace, however long it has been silent', () => {
    expect(() =>
      reportedThrough(
        present(),
        THROUGH_TRUST,
        later(24 * 3_600_000),
        [],
        WorkspaceId.of('ws_2'),
      ),
    ).toThrow(HostTakenError);
  });

  it('answers for a minute and a half after it last reported', () => {
    const host = present();

    expect(host.answersAt(later(89_999))).toBe(true);
    expect(host.answersAt(later(90_000))).toBe(false);
    expect(
      reportedThrough(host, THROUGH_POOL, later(60_000)).answersAt(
        later(120_000),
      ),
    ).toBe(true);
  });

  it('is remembered for a day after it last reported', () => {
    const DAY = 24 * 60 * 60_000;

    expect(RunnerHost.rememberedSince(later(DAY))).toEqual(FIRST_SEEN);
  });

  it('tells whether a host last seen at a moment answers now, by the same rule as a host it holds', () => {
    expect(RunnerHost.answering(FIRST_SEEN, later(89_999))).toBe(true);
    expect(RunnerHost.answering(FIRST_SEEN, later(90_000))).toBe(false);
  });

  it('serves only through the way it first came in', () => {
    const host = present();

    expect(host.servesThrough(Admission.of('pool', 'pool_1'))).toBe(true);
    expect(host.servesThrough(Admission.of('pool', 'pool_2'))).toBe(false);
    expect(host.servesThrough(Admission.of('trust', 'pool_1'))).toBe(false);
  });

  it('starts serving when it first reports an image with a harness', () => {
    const host = present(SERVING);

    expect(host.servesAHarness).toBe(true);
    expect(kindsOf(host)).toEqual(['runner-host.started-serving']);
  });

  it('does not serve on a report with no image, a refused image or an image without a harness', () => {
    for (const images of [
      [],
      [{ ...SERVING[0], refused: 'pull access denied' }],
      [{ ...SERVING[0], harnesses: [] }],
    ] as Images[]) {
      const host = present(images);

      expect(host.servesAHarness).toBe(false);
      expect(kindsOf(host)).toEqual([]);
    }
  });

  it('starts serving on the first later report that offers a harness', () => {
    const host = present();
    kindsOf(host);

    expect(kindsOf(reportedServing(host, THROUGH_POOL, later(30_000)))).toEqual(
      ['runner-host.started-serving'],
    );
  });

  it('does not start serving again while it keeps serving', () => {
    const host = present(SERVING);
    kindsOf(host);

    expect(kindsOf(reportedServing(host, THROUGH_POOL, later(30_000)))).toEqual(
      [],
    );
  });

  it('starts serving again once re-homed through another way in', () => {
    const host = present(SERVING);
    kindsOf(host);

    expect(
      kindsOf(reportedServing(host, THROUGH_TRUST, later(90_000))),
    ).toEqual(['runner-host.started-serving']);
  });

  it('is not read back last seen before it was first seen', () => {
    expect(() => rehydrated({ firstSeenAt: later(1) })).toThrow(
      InconsistentStateError,
    );
  });

  it('is not read back at an impossible version', () => {
    for (const version of [-1, 1.5]) {
      expect(() => rehydrated({ version })).toThrow(InconsistentStateError);
    }
  });
});
