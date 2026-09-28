import { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import { RedemptionRecipientPinnedError } from '@secrets/domain/exceptions/redemption-recipient-pinned.error';
import { RunGrantsEndedError } from '@secrets/domain/exceptions/run-grants-ended.error';
import { RunHoldOverError } from '@secrets/domain/exceptions/run-hold-over.error';
import { RedemptionRecipient } from '@secrets/domain/value-objects/redemption-recipient.vo';
import { RunHold } from '@secrets/domain/value-objects/run-hold.vo';
import { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const FIRST = RunHold.of(RUN, 1);
const SECOND = RunHold.of(RUN, 2);
const EGRESS = RedemptionRecipient.of('recipient-key');
const RESTARTED = RedemptionRecipient.of('another-key');
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

const begun = () => RunGrants.begun(FIRST, WORKSPACE);

const endedAfter = (ms: number) => new Date(ENDED_AT.getTime() + ms);

describe('RunGrants', () => {
  it('allows a secret toward each host its hold was granted, once however often granted', () => {
    const granted = begun().granted(FIRST, [
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

  it('changes nothing when granted what it already holds', () => {
    const granted = begun().granted(FIRST, [grant()]);

    expect(granted.granted(FIRST, [grant()])).toBe(granted);
  });

  it('holds only grants to its own run, for holds of its own run', () => {
    expect(() =>
      begun().granted(FIRST, [grant('api.linear.app', { runId: 'run_2' })]),
    ).toThrow(InconsistentStateError);
    expect(() =>
      begun().granted(RunHold.of(RunId.of('run_2'), 1), [grant()]),
    ).toThrow(InconsistentStateError);
  });

  it('pins the recipient a hold first redeems for, answering it again and refusing any other', () => {
    const pinned = begun().redeemedFor(FIRST, EGRESS);

    expect(pinned.recipient).toEqual(EGRESS);
    expect(pinned.redeemedFor(FIRST, EGRESS)).toBe(pinned);
    expect(() => pinned.redeemedFor(FIRST, RESTARTED)).toThrow(
      RedemptionRecipientPinnedError,
    );
  });

  it('starts afresh when the run is held again, dropping the earlier hold’s grants and pin', () => {
    const held = begun().granted(FIRST, [grant()]).redeemedFor(FIRST, EGRESS);

    const again = held.redeemedFor(SECOND, RESTARTED);

    expect(again.hold).toEqual(SECOND);
    expect(again.recipient).toEqual(RESTARTED);
    expect(again.grants).toEqual([]);
    expect(again.granted(SECOND, [grant()]).allows(SECOND, grant())).toBe(true);
  });

  it('allows nothing to, and grants and redeems nothing for, a hold the run has moved past', () => {
    const moved = begun().granted(FIRST, [grant()]).granted(SECOND, [grant()]);

    expect(moved.allows(FIRST, grant())).toBe(false);
    expect(() => moved.granted(FIRST, [grant()])).toThrow(RunHoldOverError);
    expect(() => moved.redeemedFor(FIRST, EGRESS)).toThrow(RunHoldOverError);
  });

  it('lets a lost hold’s grants go without ending the run, so its next hold is granted afresh', () => {
    const lost = begun()
      .granted(FIRST, [grant()])
      .redeemedFor(FIRST, EGRESS)
      .lostHold(FIRST);

    expect(lost.isHoldLost).toBe(true);
    expect(lost.isEnded).toBe(false);
    expect(lost.grants).toEqual([]);
    expect(lost.allows(FIRST, grant())).toBe(false);
    expect(lost.lostHold(FIRST)).toBe(lost);
    expect(() => lost.granted(FIRST, [grant()])).toThrow(RunHoldOverError);
    expect(() => lost.redeemedFor(FIRST, EGRESS)).toThrow(RunHoldOverError);

    const regranted = lost
      .redeemedFor(SECOND, RESTARTED)
      .granted(SECOND, [grant()]);

    expect(regranted.isHoldLost).toBe(false);
    expect(regranted.allows(SECOND, grant())).toBe(true);
  });

  it('keeps a later hold when an earlier one is lost', () => {
    const later = begun().granted(SECOND, [grant()]);

    expect(later.lostHold(FIRST)).toBe(later);
  });

  it('lets every grant go once its run ends, and grants and redeems nothing after, whatever the hold', () => {
    const ended = begun()
      .granted(FIRST, [grant()])
      .redeemedFor(FIRST, EGRESS)
      .ended(ENDED_AT);

    expect(ended.isEnded).toBe(true);
    expect(ended.grants).toEqual([]);
    expect(ended.allows(FIRST, grant())).toBe(false);
    expect(ended.ended(endedAfter(1))).toBe(ended);
    expect(ended.lostHold(SECOND)).toBe(ended);
    expect(() => ended.granted(SECOND, [grant()])).toThrow(RunGrantsEndedError);
    expect(() => ended.redeemedFor(SECOND, RESTARTED)).toThrow(
      RunGrantsEndedError,
    );
  });

  it('is forgotten a week after its run ends, and not before', () => {
    const ended = begun().granted(FIRST, [grant()]).ended(ENDED_AT);

    expect(begun().isForgettableAt(endedAfter(WEEK * 52))).toBe(false);
    expect(ended.isForgettableAt(endedAfter(WEEK - 1))).toBe(false);
    expect(() => ended.forgotten(endedAfter(WEEK - 1))).toThrow(
      InconsistentStateError,
    );
    expect(ended.forgotten(endedAfter(WEEK)).isDiscarded).toBe(true);
    expect(RunGrants.endedForgettablyBy(endedAfter(WEEK))).toEqual(ENDED_AT);
  });

  it('is forgotten at once when its workspace is abandoned, ended or not', () => {
    expect(begun().granted(FIRST, [grant()]).abandoned().isDiscarded).toBe(
      true,
    );
  });

  it('is kept only at a version it could have been saved at, never granted past its hold', () => {
    const kept = {
      hold: FIRST,
      workspaceId: WORKSPACE,
      recipient: null,
      holdLost: false,
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
        holdLost: true,
        version: 2,
      }),
    ).toThrow(InconsistentStateError);
  });

  it('hands out a copy of its grants, never its own list', () => {
    const granted = begun().granted(FIRST, [grant()]);

    (granted.grants as SecretGrant[]).push(grant('uploads.linear.app'));

    expect(granted.allows(FIRST, grant('uploads.linear.app'))).toBe(false);
  });
});
