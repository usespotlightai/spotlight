import {
  ClaimsSource,
  type CommitPullRequest,
} from '@insights/domain/aggregates/claims-source.aggregate';
import { InvalidClaimsSourceError } from '@insights/domain/exceptions/invalid-claims-source.error';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { SourceCommit } from '@shared-kernel/domain/value-objects/source-commit.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const SHA = '3f1c9a7e5b2d4c6f8a0e1b3d5c7f9a2e4b6d8c0f';

const RECORDED_AT = new Date('2026-11-14T09:00:00Z');

const RESOLVED_AT = new Date('2026-11-14T09:01:00Z');

const recorded = () =>
  ClaimsSource.recorded({
    station: {
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      lineId: LineId.of('line_1'),
      stationId: StationId.of('station_1'),
    },
    rubricVersion: RubricVersion.of('a'.repeat(64)),
    commit: SourceCommit.of({ repository: 'acme/config', sha: SHA }),
    at: RECORDED_AT,
  });

const pullRequest = (number: number, merged: boolean): CommitPullRequest => ({
  number,
  url: `https://github.com/acme/config/pull/${number}`,
  title: `Change ${number}`,
  merged,
});

const minutesAfter = (minutes: number) =>
  new Date(RECORDED_AT.getTime() + minutes * 60_000);

const kindsOf = (source: ClaimsSource) =>
  source.pullEvents().map((each) => each.kind);

describe('ClaimsSource', () => {
  it('keeps the commit of a new claims version until it finds its pull request', () => {
    const source = recorded();

    expect(source.commit.sha).toBe(SHA);
    expect(source.pullRequest).toBeNull();
    expect(source.resolvedAt).toBeNull();
    expect(kindsOf(source)).toEqual(['claims-source.recorded']);
  });

  it('takes the merged pull request of the commit', () => {
    const source = recorded().mergedBy(
      [pullRequest(12, false), pullRequest(13, true)],
      RESOLVED_AT,
    );

    expect(source.pullRequest).toEqual({
      number: 13,
      url: 'https://github.com/acme/config/pull/13',
      title: 'Change 13',
    });
    expect(source.resolvedAt).toEqual(RESOLVED_AT);
    expect(kindsOf(source)).toEqual([
      'claims-source.recorded',
      'claims-source.resolved',
    ]);
  });

  it('takes the first pull request when none merged', () => {
    expect(
      recorded().mergedBy(
        [pullRequest(12, false), pullRequest(13, false)],
        RESOLVED_AT,
      ).pullRequest?.number,
    ).toBe(12);
  });

  it('looks up its pull request at once, then again after 1, 5 and 30 minutes while no pull request has the commit', () => {
    const fresh = recorded();
    const first = fresh.mergedBy([], RECORDED_AT);
    const second = first.mergedBy([], minutesAfter(1));
    const third = second.mergedBy([], minutesAfter(6));

    expect(fresh.job?.isDue(RECORDED_AT)).toBe(true);
    expect(
      [first, second, third].map((each) => [
        each.lookups,
        each.job?.nextAttemptAt,
        each.job?.attempts,
        each.resolvedAt,
      ]),
    ).toEqual([
      [1, minutesAfter(1), 0, null],
      [2, minutesAfter(6), 0, null],
      [3, minutesAfter(36), 0, null],
    ]);
    expect(kindsOf(third)).toEqual(['claims-source.recorded']);
  });

  it('keeps only the commit after its last lookup finds no pull request', () => {
    const source = [0, 1, 6, 36].reduce(
      (each, minutes) => each.mergedBy([], minutesAfter(minutes)),
      recorded(),
    );

    expect(source.lookups).toBe(4);
    expect(source.pullRequest).toBeNull();
    expect(source.resolvedAt).toEqual(minutesAfter(36));
    expect(source.hasPendingJob).toBe(false);
    expect(kindsOf(source)).toEqual([
      'claims-source.recorded',
      'claims-source.resolved',
    ]);
  });

  it('takes a pull request a later lookup finds', () => {
    const source = recorded()
      .mergedBy([], RECORDED_AT)
      .mergedBy([pullRequest(12, true)], minutesAfter(1));

    expect(source.pullRequest?.number).toBe(12);
    expect(source.resolvedAt).toEqual(minutesAfter(1));
  });

  it('keeps only the commit once a lookup keeps failing', () => {
    const source = recorded().deadLetter(RESOLVED_AT);

    expect(source.pullRequest).toBeNull();
    expect(source.resolvedAt).toEqual(RESOLVED_AT);
    expect(source.hasPendingJob).toBe(false);
  });

  it('is leased only while unresolved and due', () => {
    const waiting = recorded().mergedBy([], RECORDED_AT);

    expect(() => waiting.leaseJob(RECORDED_AT)).toThrow(
      InvalidClaimsSourceError,
    );
    expect(waiting.leaseJob(minutesAfter(1)).job?.attempts).toBe(1);
    expect(() =>
      recorded()
        .mergedBy([pullRequest(12, true)], RECORDED_AT)
        .leaseJob(RECORDED_AT),
    ).toThrow(InvalidClaimsSourceError);
  });

  it('waits without spending the lookup it leased', () => {
    const waiting = recorded()
      .mergedBy([], RECORDED_AT)
      .leaseJob(minutesAfter(1))
      .waitJob(minutesAfter(1));

    expect(waiting.job?.attempts).toBe(0);
    expect(waiting.job?.waitingSince).toEqual(minutesAfter(1));
  });

  it('looks up its pull request exactly while unresolved, at most four times', () => {
    const source = recorded();
    const fields = {
      station: source.station,
      rubricVersion: source.rubricVersion,
      commit: source.commit,
      recordedAt: source.recordedAt,
      pullRequest: null,
      resolvedAt: null,
      job: source.job,
      lookups: 0,
      version: 0,
    };

    expect(ClaimsSource.rehydrate(fields).hasPendingJob).toBe(true);
    expect(() => ClaimsSource.rehydrate({ ...fields, job: null })).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      ClaimsSource.rehydrate({ ...fields, resolvedAt: RESOLVED_AT }),
    ).toThrow(InconsistentStateError);
    expect(() => ClaimsSource.rehydrate({ ...fields, lookups: 5 })).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      ClaimsSource.rehydrate({
        ...fields,
        pullRequest: { number: 12, url: 'https://x', title: 'x' },
      }),
    ).toThrow(InconsistentStateError);
  });

  it('keeps the pull request it found first', () => {
    const resolved = recorded().mergedBy([pullRequest(12, true)], RESOLVED_AT);

    expect(resolved.mergedBy([pullRequest(14, true)], new Date())).toBe(
      resolved,
    );
  });

  it('is erased with its team or workspace', () => {
    const deleted = recorded().delete();

    expect(deleted.isDeleted).toBe(true);
    expect(kindsOf(deleted)).toEqual([
      'claims-source.recorded',
      'claims-source.erased',
    ]);
  });
});
