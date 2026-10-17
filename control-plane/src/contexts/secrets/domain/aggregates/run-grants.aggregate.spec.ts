import { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import { RecipientPinnedError } from '@secrets/domain/exceptions/recipient-pinned.error';
import { RunGrantsEndedError } from '@secrets/domain/exceptions/run-grants-ended.error';
import { RunLeaseOverError } from '@secrets/domain/exceptions/run-lease-over.error';
import { Recipient } from '@secrets/domain/value-objects/recipient.vo';
import { RunLease } from '@secrets/domain/value-objects/run-lease.vo';
import { SecretFetcher } from '@secrets/domain/value-objects/secret-fetcher.vo';
import { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const FIRST = RunLease.of(RUN, 1);
const SECOND = RunLease.of(RUN, 2);
const SIDECAR = SecretFetcher.sidecar(Recipient.of('recipient-key'));
const RESTARTED = SecretFetcher.sidecar(Recipient.of('another-key'));
const SHARED = SecretFetcher.shared(Recipient.of('recipient-key'), 'egress_1');
const ANOTHER_NODE = SecretFetcher.shared(
  Recipient.of('another-key'),
  'egress_1',
);
const ANOTHER_EGRESS = SecretFetcher.shared(
  Recipient.of('another-key'),
  'egress_2',
);
const ENDED_AT = new Date('2026-09-23T12:00:00.000Z');
const WEEK = 7 * 24 * 60 * 60_000;

const grant = (
  host = 'api.linear.app',
  over: { runId?: string; workspaceId?: string } = {},
) =>
  SecretGrant.of({
    runId: RunId.of(over.runId ?? 'run_1'),
    workspaceId: WorkspaceId.of(over.workspaceId ?? 'ws_1'),
    secretId: SecretId.of('secret_linear'),
    host,
  });

const begun = () => RunGrants.start(FIRST, WORKSPACE);

const endedAfter = (ms: number) => new Date(ENDED_AT.getTime() + ms);

describe('RunGrants', () => {
  it('allows a secret for each host its lease was granted, once however often granted', () => {
    const granted = begun().grant(FIRST, [
      grant(),
      grant(),
      grant('mcp.linear.app'),
    ]);

    expect(granted.grants).toHaveLength(2);
    expect(granted.allows(FIRST, grant())).toBe(true);
    expect(granted.allows(FIRST, grant('uploads.linear.app'))).toBe(false);
    expect(
      granted.allows(FIRST, grant('api.linear.app', { workspaceId: 'ws_2' })),
    ).toBe(false);
  });

  it('changes nothing when granted what it already has', () => {
    const granted = begun().grant(FIRST, [grant()]);

    expect(granted.grant(FIRST, [grant()])).toBe(granted);
  });

  it('keeps only grants to its own run, for leases of its own run', () => {
    expect(() =>
      begun().grant(FIRST, [grant('api.linear.app', { runId: 'run_2' })]),
    ).toThrow(InconsistentStateError);
    expect(() =>
      begun().grant(RunLease.of(RunId.of('run_2'), 1), [grant()]),
    ).toThrow(InconsistentStateError);
  });

  it('pins the recipient a lease first fetches for, answering it again and rejecting any other', () => {
    const pinned = begun().recordFetch(FIRST, SIDECAR);

    expect(pinned.fetcher).toEqual(SIDECAR);
    expect(pinned.recordFetch(FIRST, SIDECAR)).toBe(pinned);
    expect(() => pinned.recordFetch(FIRST, RESTARTED)).toThrow(
      RecipientPinnedError,
    );
    expect(() => pinned.recordFetch(FIRST, SHARED)).toThrow(
      RecipientPinnedError,
    );
  });

  it('pins a shared egress, not its key, so another node of that egress can fetch again', () => {
    const pinned = begun().recordFetch(FIRST, SHARED);

    expect(pinned.recordFetch(FIRST, SHARED)).toBe(pinned);
    expect(pinned.recordFetch(FIRST, ANOTHER_NODE).recipient).toEqual(
      Recipient.of('another-key'),
    );
    expect(() => pinned.recordFetch(FIRST, ANOTHER_EGRESS)).toThrow(
      RecipientPinnedError,
    );
    expect(() => pinned.recordFetch(FIRST, SIDECAR)).toThrow(
      RecipientPinnedError,
    );
  });

  it('starts afresh when the run is leased again, dropping the grants and pin of the earlier lease', () => {
    const pinned = begun().grant(FIRST, [grant()]).recordFetch(FIRST, SIDECAR);

    const again = pinned.recordFetch(SECOND, RESTARTED);

    expect(again.lease).toEqual(SECOND);
    expect(again.fetcher).toEqual(RESTARTED);
    expect(again.grants).toEqual([]);
    expect(again.grant(SECOND, [grant()]).allows(SECOND, grant())).toBe(true);
  });

  it('allows nothing to, and grants and fetches nothing for, a lease the run has moved past', () => {
    const moved = begun().grant(FIRST, [grant()]).grant(SECOND, [grant()]);

    expect(moved.allows(FIRST, grant())).toBe(false);
    expect(() => moved.grant(FIRST, [grant()])).toThrow(RunLeaseOverError);
    expect(() => moved.recordFetch(FIRST, SIDECAR)).toThrow(RunLeaseOverError);
  });

  it('lets the grants of a lost lease go without ending the run, so its next lease is granted afresh', () => {
    const lost = begun()
      .grant(FIRST, [grant()])
      .recordFetch(FIRST, SIDECAR)
      .loseLease(FIRST);

    expect(lost.isLeaseLost).toBe(true);
    expect(lost.isEnded).toBe(false);
    expect(lost.grants).toEqual([]);
    expect(lost.allows(FIRST, grant())).toBe(false);
    expect(lost.loseLease(FIRST)).toBe(lost);
    expect(() => lost.grant(FIRST, [grant()])).toThrow(RunLeaseOverError);
    expect(() => lost.recordFetch(FIRST, SIDECAR)).toThrow(RunLeaseOverError);

    const regranted = lost
      .recordFetch(SECOND, RESTARTED)
      .grant(SECOND, [grant()]);

    expect(regranted.isLeaseLost).toBe(false);
    expect(regranted.allows(SECOND, grant())).toBe(true);
  });

  it('keeps a later lease when an earlier one is lost', () => {
    const later = begun().grant(SECOND, [grant()]);

    expect(later.loseLease(FIRST)).toBe(later);
  });

  it('releases every grant once its run ends, and grants and fetches nothing after, whatever the lease', () => {
    const ended = begun()
      .grant(FIRST, [grant()])
      .recordFetch(FIRST, SIDECAR)
      .end(ENDED_AT);

    expect(ended.isEnded).toBe(true);
    expect(ended.grants).toEqual([]);
    expect(ended.allows(FIRST, grant())).toBe(false);
    expect(ended.end(endedAfter(1))).toBe(ended);
    expect(ended.loseLease(SECOND)).toBe(ended);
    expect(() => ended.grant(SECOND, [grant()])).toThrow(RunGrantsEndedError);
    expect(() => ended.recordFetch(SECOND, RESTARTED)).toThrow(
      RunGrantsEndedError,
    );
  });

  it('is forgotten a week after its run ends, and not before', () => {
    const ended = begun().grant(FIRST, [grant()]).end(ENDED_AT);

    expect(begun().isForgettableAt(endedAfter(WEEK * 52))).toBe(false);
    expect(ended.isForgettableAt(endedAfter(WEEK - 1))).toBe(false);
    expect(() => ended.purge(endedAfter(WEEK - 1))).toThrow(
      InconsistentStateError,
    );
    expect(ended.purge(endedAfter(WEEK)).isDiscarded).toBe(true);
    expect(RunGrants.endedForgettablyBy(endedAfter(WEEK))).toEqual(ENDED_AT);
  });

  it('is forgotten at once when its workspace is abandoned, ended or not', () => {
    expect(begun().grant(FIRST, [grant()]).abandon().isDiscarded).toBe(true);
  });

  it('is kept only at a version it could have been saved at, never granted past its lease', () => {
    const kept = {
      lease: FIRST,
      workspaceId: WORKSPACE,
      fetcher: null,
      leaseLost: false,
      endedAt: null,
    };

    expect(() =>
      RunGrants.rehydrate({ ...kept, grants: [], version: 0 }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      RunGrants.rehydrate({
        ...kept,
        grants: [grant()],
        endedAt: ENDED_AT,
        version: 2,
      }),
    ).toThrow(InconsistentStateError);
    expect(() =>
      RunGrants.rehydrate({
        ...kept,
        grants: [grant()],
        leaseLost: true,
        version: 2,
      }),
    ).toThrow(InconsistentStateError);
  });

  it('hands out a copy of its grants, never its own list', () => {
    const granted = begun().grant(FIRST, [grant()]);

    (granted.grants as SecretGrant[]).push(grant('uploads.linear.app'));

    expect(granted.allows(FIRST, grant('uploads.linear.app'))).toBe(false);
  });
});
