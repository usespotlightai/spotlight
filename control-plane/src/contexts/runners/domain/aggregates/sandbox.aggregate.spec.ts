import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import {
  aSandbox,
  DRAIN_POLICY,
  EDITOR_LIMIT_MS,
  GRACE_MS,
  tokenHashOf,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import {
  EDITOR_LEASE_MS,
  SandboxLease,
} from '@runners/domain/value-objects/sandbox-lease.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const STARTED_AT = new Date('2026-10-30T10:00:00.000Z');

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const HOST = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');

const started = () =>
  aSandbox({
    workspaceId: WorkspaceId.of('ws_1'),
    hostId: HOST,
    at: STARTED_AT,
  });

const withLeases = (leases: SandboxLease[], idleSince: Date | null) => {
  const sandbox = started().reported();

  return Sandbox.rehydrate({
    id: sandbox.id,
    workspaceId: sandbox.workspaceId,
    key: sandbox.key,
    hostId: sandbox.hostId,
    tokenHash: sandbox.tokenHash,
    state: sandbox.current,
    leases,
    idleSince,
    startedAt: sandbox.startedAt,
    goneAt: null,
    version: 0,
  });
};

describe('Sandbox', () => {
  it('starts for a run, held by that run, until its host reports it', () => {
    const sandbox = started();

    expect(sandbox.current).toBe('starting');
    expect(sandbox.holdsRun('run_1')).toBe(true);
    expect(sandbox.idleSince).toBeNull();
    expect(sandbox.reported().current).toBe('ready');
  });

  it('becomes idle when its run lets go of it, and ignores a run that does not hold it', () => {
    const sandbox = started().reported();

    expect(sandbox.releaseRun('run_2', later(1_000))).toBe(sandbox);

    const released = sandbox.releaseRun('run_1', later(1_000));

    expect(released.holdsRun('run_1')).toBe(false);
    expect(released.leases).toEqual([]);
    expect(released.idleSince).toEqual(later(1_000));
  });

  it('takes the next run on its host once ready and idle, and holds it', () => {
    const idle = started().reported().releaseRun('run_1', later(1_000));

    expect(idle.takesRunOn(HOST)).toBe(true);
    expect(idle.takesRunOn(HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDF'))).toBe(
      false,
    );
    expect(started().takesRunOn(HOST)).toBe(false);
    expect(started().reported().takesRunOn(HOST)).toBe(false);
    expect(idle.drain().takesRunOn(HOST)).toBe(false);

    const held = idle.holdRun('run_2', later(2_000));

    expect(held.holdsRun('run_2')).toBe(true);
    expect(held.idleSince).toBeNull();
    expect(held.takesRunOn(HOST)).toBe(false);
    expect(held.holdRun('run_2', later(3_000))).toBe(held);
  });

  it('takes no run once it drains', () => {
    const draining = started()
      .reported()
      .releaseRun('run_1', later(1_000))
      .drain();

    expect(() => draining.holdRun('run_2', later(2_000))).toThrow(
      'cannot take run run_2',
    );
  });

  it('drains once it holds no lease for the grace, and not before', () => {
    const idle = started().reported().releaseRun('run_1', later(0));

    expect(idle.drainDue(DRAIN_POLICY, later(GRACE_MS - 1))).toBe(false);
    expect(idle.drainedWhenDue(DRAIN_POLICY, later(GRACE_MS - 1))).toBe(idle);
    expect(idle.drainedWhenDue(DRAIN_POLICY, later(GRACE_MS)).current).toBe(
      'draining',
    );
  });

  it('drains at once when idle and its host stops, but not while a run holds it', () => {
    const held = started().reported();

    expect(held.drainedWhenIdle()).toBe(held);
    expect(held.releaseRun('run_1', later(0)).drainedWhenIdle().current).toBe(
      'draining',
    );
  });

  it('never drains while a run holds it', () => {
    const held = started().reported();

    expect(held.drainDue(DRAIN_POLICY, later(EDITOR_LIMIT_MS * 2))).toBe(false);
  });

  it('drains when only editors held it past the editor limit after its last run', () => {
    const edited = withLeases(
      [SandboxLease.of('editor', 'person_1', later(0))],
      later(0),
    );

    expect(edited.drainDue(DRAIN_POLICY, later(GRACE_MS))).toBe(false);
    expect(edited.drainDue(DRAIN_POLICY, later(EDITOR_LIMIT_MS - 1))).toBe(
      false,
    );
    expect(edited.drainDue(DRAIN_POLICY, later(EDITOR_LIMIT_MS))).toBe(true);
  });

  it('does not drain twice and is never drained once gone', () => {
    const draining = started().drain();

    expect(draining.current).toBe('draining');
    expect(draining.drain()).toBe(draining);
    expect(draining.mustDrain).toBe(true);
    expect(draining.lost(later(1)).drain().current).toBe('gone');
  });

  it('is gone once its host no longer reports it', () => {
    const ready = started().reported();
    const gone = ready.unreported(later(1_000));

    expect(gone.current).toBe('gone');
    expect(gone.goneAt).toEqual(later(1_000));
    expect(gone.isLive).toBe(false);
    expect(started().drain().unreported(later(1)).current).toBe('gone');
  });

  it('gives a starting sandbox a minute before a report without it counts', () => {
    expect(started().unreported(later(59_999)).current).toBe('starting');
    expect(started().unreported(later(60_000)).current).toBe('gone');
  });

  it('is gone when its host goes silent, whatever its state', () => {
    expect(started().lost(later(1)).current).toBe('gone');
    expect(started().reported().drain().lost(later(1)).current).toBe('gone');
  });

  it('cannot be idle while a run holds it', () => {
    expect(() =>
      withLeases([SandboxLease.forRun('run_1', later(0))], later(0)),
    ).toThrow(InconsistentStateError);
    expect(() => withLeases([], null)).toThrow(InconsistentStateError);
  });
  describe('requested with no run', () => {
    const requested = () =>
      Sandbox.request({
        id: SandboxId.of('sandbox_r'),
        workspaceId: WorkspaceId.of('ws_1'),
        key: SandboxKey.of('task-task_1'),
        at: STARTED_AT,
      });

    it('waits on no host, held by nothing and idle from the request', () => {
      const sandbox = requested();

      expect(sandbox.current).toBe('starting');
      expect(sandbox.isRequested).toBe(true);
      expect(sandbox.hostId).toBeNull();
      expect(sandbox.tokenHash).toBeNull();
      expect(sandbox.leases).toEqual([]);
      expect(sandbox.idleSince).toEqual(STARTED_AT);
      expect(sandbox.takesRunOn(HOST)).toBe(false);
    });

    it('starts on the host that claims it and becomes idle from then', () => {
      const placed = requested().placeOn(
        HOST,
        tokenHashOf('token'),
        later(5_000),
      );

      expect(placed.isRequested).toBe(false);
      expect(placed.hostId?.equals(HOST)).toBe(true);
      expect(placed.startedAt).toEqual(later(5_000));
      expect(placed.idleSince).toEqual(later(5_000));
      expect(placed.reported().takesRunOn(HOST)).toBe(true);
      expect(() =>
        placed.placeOn(HOST, tokenHashOf('token'), later(6_000)),
      ).toThrow(InconsistentStateError);
    });

    it('is lost, not drained, when no host claims it within the grace', () => {
      const sandbox = requested();

      expect(
        sandbox.drainedWhenDue(DRAIN_POLICY, later(GRACE_MS)).current,
      ).toBe('gone');
      expect(() => sandbox.drain()).toThrow(InconsistentStateError);
    });

    it('takes no run before a host starts it', () => {
      expect(() => requested().holdRun('run_1', later(1))).toThrow(
        InconsistentStateError,
      );
    });

    it('cannot have a host without a token', () => {
      const sandbox = started();

      expect(() =>
        Sandbox.rehydrate({
          id: sandbox.id,
          workspaceId: sandbox.workspaceId,
          key: sandbox.key,
          hostId: sandbox.hostId,
          tokenHash: null,
          state: sandbox.current,
          leases: sandbox.leases,
          idleSince: sandbox.idleSince,
          startedAt: sandbox.startedAt,
          goneAt: null,
          version: 0,
        }),
      ).toThrow(InconsistentStateError);
    });
  });

  describe('held by editors', () => {
    const idle = () => started().reported().releaseRun('run_1', later(0));

    it('takes one lease per connection, renewed in place, and stays idle for runs', () => {
      const held = idle()
        .holdEditor('conn_1', later(1_000))
        .holdEditor('conn_1', later(31_000));

      expect(held.leases).toEqual([
        SandboxLease.forEditor('conn_1', later(31_000)),
      ]);
      expect(held.idleSince).toEqual(later(0));
      expect(held.takesRunOn(HOST)).toBe(true);
    });

    it('keeps its editors while a run holds it, and drops editor leases that expired', () => {
      const shared = started()
        .reported()
        .holdEditor('conn_1', later(0))
        .holdEditor('conn_2', later(EDITOR_LEASE_MS));

      const live = shared.withoutExpiredEditors(later(EDITOR_LEASE_MS));

      expect(live.holdsRun('run_1')).toBe(true);
      expect(live.holdsEditor('conn_1')).toBe(false);
      expect(live.holdsEditor('conn_2')).toBe(true);
      expect(shared.releaseRun('run_1', later(1)).holdsEditor('conn_2')).toBe(
        true,
      );
    });

    it('counts the grace from the moment its last editor leaves', () => {
      const left = idle()
        .holdEditor('conn_1', later(1_000))
        .releaseEditor('conn_1', later(GRACE_MS * 3));

      expect(left.leases).toEqual([]);
      expect(left.idleSince).toEqual(later(GRACE_MS * 3));
      expect(left.drainDue(DRAIN_POLICY, later(GRACE_MS * 4 - 1))).toBe(false);
      expect(left.drainDue(DRAIN_POLICY, later(GRACE_MS * 4))).toBe(true);
      expect(left.releaseEditor('conn_1', later(GRACE_MS * 5))).toBe(left);
    });

    it('drops an editor lease nobody renewed, and then drains after the grace', () => {
      const forgotten = idle().holdEditor('conn_1', later(0));
      const expiry = later(EDITOR_LEASE_MS);

      expect(
        forgotten.drainedWhenDue(DRAIN_POLICY, later(EDITOR_LEASE_MS - 1)),
      ).toBe(forgotten);

      const dropped = forgotten.drainedWhenDue(DRAIN_POLICY, expiry);

      expect(dropped.leases).toEqual([]);
      expect(dropped.current).toBe('ready');
      expect(dropped.idleSince).toEqual(expiry);
      expect(
        dropped.drainedWhenDue(
          DRAIN_POLICY,
          new Date(expiry.getTime() + GRACE_MS),
        ).current,
      ).toBe('draining');
    });

    it('drains at the editor limit even while an editor renews its lease', () => {
      const renewed = idle().holdEditor('conn_1', later(EDITOR_LIMIT_MS - 1));

      expect(
        renewed.drainedWhenDue(DRAIN_POLICY, later(EDITOR_LIMIT_MS)).current,
      ).toBe('draining');
    });

    it('lets an editor hold a sandbox that waits for a host', () => {
      const requested = Sandbox.request({
        id: SandboxId.of('sandbox_r'),
        workspaceId: WorkspaceId.of('ws_1'),
        key: SandboxKey.of('task-task_1'),
        at: STARTED_AT,
      }).holdEditor('conn_1', later(1_000));

      expect(requested.holdsEditor('conn_1')).toBe(true);
      expect(
        Sandbox.rehydrate({
          id: requested.id,
          workspaceId: requested.workspaceId,
          key: requested.key,
          hostId: null,
          tokenHash: null,
          state: 'starting',
          leases: requested.leases,
          idleSince: requested.idleSince,
          startedAt: requested.startedAt,
          goneAt: null,
          version: 0,
        }).holdsEditor('conn_1'),
      ).toBe(true);
    });

    it('takes no editor once it drains', () => {
      expect(() => idle().drain().holdEditor('conn_1', later(1_000))).toThrow(
        InconsistentStateError,
      );
    });
  });
});
