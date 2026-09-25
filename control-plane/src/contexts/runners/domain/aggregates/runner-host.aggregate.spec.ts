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

const reportOf = (running: string[] = []) =>
  HostReport.of({
    name: 'build-box',
    release: '0.9.0',
    executor: 'docker',
    capacity: 4,
    running,
    images: [],
  });

const present = () =>
  RunnerHost.present({
    id: HOST,
    workspaceId: WorkspaceId.of('ws_1'),
    admission: THROUGH_POOL,
    report: reportOf(),
    at: FIRST_SEEN,
  });

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
) =>
  host.reportedThrough({
    admission,
    workspaceId,
    report: reportOf(running),
    at,
  });

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

  it('serves only through the way it first came in', () => {
    const host = present();

    expect(host.servesThrough(Admission.of('pool', 'pool_1'))).toBe(true);
    expect(host.servesThrough(Admission.of('pool', 'pool_2'))).toBe(false);
    expect(host.servesThrough(Admission.of('trust', 'pool_1'))).toBe(false);
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
