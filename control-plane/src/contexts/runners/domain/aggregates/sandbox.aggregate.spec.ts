import {
  aHost,
  aPullPool,
  aTrust,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import {
  aSandbox,
  DRAIN_POLICY,
  EDITOR_LIMIT_MS,
  GRACE_MS,
  tokenHashOf,
  WARM_AGE_MS,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import { UnknownHostError } from '@runners/domain/exceptions/unknown-host.error';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { LeaseHolder } from '@runners/domain/value-objects/lease-holder.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import {
  EDITOR_LEASE_MS,
  SandboxLease,
} from '@runners/domain/value-objects/sandbox-lease.vo';
import { WarmPart } from '@runners/domain/value-objects/warm-part.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const STARTED_AT = new Date('2026-10-30T10:00:00.000Z');

const later = (ms: number): Date => new Date(STARTED_AT.getTime() + ms);

const NOW = later(1_000);

const HOST = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');

const OTHER_HOST = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDF');

const reporting = aHost({ at: STARTED_AT, id: HOST, sandboxes: ['sandbox_1'] });

const silent = aHost({ at: STARTED_AT, id: HOST });

const stopping = aHost({
  at: STARTED_AT,
  id: HOST,
  sandboxes: ['sandbox_1'],
  stopping: true,
});

const editor = (connection: string) => LeaseHolder.editor(connection);

const started = () =>
  aSandbox({
    workspaceId: WorkspaceId.of('ws_1'),
    hostId: HOST,
    at: STARTED_AT,
  });

const withLeases = (leases: SandboxLease[], idleSince: Date | null) => {
  const sandbox = started();

  return Sandbox.rehydrate({
    id: sandbox.id,
    workspaceId: sandbox.workspaceId,
    key: sandbox.key,
    hostId: sandbox.hostId,
    source: sandbox.source,
    tokenHash: sandbox.tokenHash,
    state: sandbox.current,
    leases,
    idleSince,
    startedAt: sandbox.startedAt,
    goneAt: null,
    warm: null,
    version: 0,
  });
};

describe('Sandbox', () => {
  it('starts for a run, held by that run, and is ready once its host reports it', () => {
    const sandbox = started();

    expect(sandbox.current).toBe('open');
    expect(sandbox.holdsRun(RunId.of('run_1'))).toBe(true);
    expect(sandbox.idleSince).toBeNull();
    expect(sandbox.statusOn(silent, NOW)).toBe('starting');
    expect(sandbox.statusOn(null, NOW)).toBe('starting');
    expect(sandbox.statusOn(reporting, NOW)).toBe('ready');
    expect(
      sandbox.isReadyOn(
        aHost({ at: STARTED_AT, id: OTHER_HOST, sandboxes: ['sandbox_1'] }),
        NOW,
      ),
    ).toBe(false);
  });

  it('is ready only while its host is online', () => {
    const sandbox = started();

    expect(sandbox.isReadyOn(reporting, later(89_999))).toBe(true);
    expect(sandbox.isReadyOn(reporting, later(90_000))).toBe(false);
    expect(sandbox.statusOn(reporting, later(90_000))).toBe('starting');
    expect(
      sandbox
        .releaseRun(RunId.of('run_1'), NOW)
        .takesRunOn(reporting, later(90_000)),
    ).toBe(false);
  });

  it('is lost when its host is gone or silent past the online window, and kept while the host is online', () => {
    const sandbox = started();

    expect(sandbox.strandedOn(reporting, later(89_999))).toBe(sandbox);
    expect(sandbox.strandedOn(reporting, later(90_000)).current).toBe('gone');
    expect(sandbox.strandedOn(null, NOW).current).toBe('gone');
    expect(
      sandbox.strandedOn(aHost({ at: STARTED_AT, id: OTHER_HOST }), NOW)
        .current,
    ).toBe('gone');
  });

  it('drains for a run that starts a new sandbox of its key, and leaves a closed one alone', () => {
    expect(started().replacedForRun().current).toBe('draining');

    const drained = started().drain();

    expect(drained.replacedForRun()).toBe(drained);
  });

  it('starts on no host of another workspace', () => {
    expect(() =>
      Sandbox.startForRun({
        id: SandboxId.of('sandbox_1'),
        workspaceId: WorkspaceId.of('ws_2'),
        key: null,
        host: reporting,
        tokenHash: tokenHashOf('token'),
        runId: RunId.of('run_1'),
        at: STARTED_AT,
      }),
    ).toThrow(UnknownHostError);
  });

  it('keeps the pool or trust of the host it started on', () => {
    expect(started().source?.poolId?.value).toBe('pool_1');

    const trust = aTrust();
    const onTrust = aSandbox({
      workspaceId: WorkspaceId.of('ws_1'),
      hostId: HOST,
      source: CredentialSource.ofId(trust.id),
      at: STARTED_AT,
    });

    expect(onTrust.source?.trustId?.equals(trust.id)).toBe(true);
    expect(onTrust.source?.poolId).toBeNull();
  });

  it('becomes idle when its run lets go of it, and ignores a run that does not hold it', () => {
    const sandbox = started();

    expect(sandbox.releaseRun(RunId.of('run_2'), later(1_000))).toBe(sandbox);

    const released = sandbox.releaseRun(RunId.of('run_1'), later(1_000));

    expect(released.holdsRun(RunId.of('run_1'))).toBe(false);
    expect(released.leases).toEqual([]);
    expect(released.idleSince).toEqual(later(1_000));
  });

  it('drains when the run that retires it holds its last lease, and ignores a run that does not hold it', () => {
    const sandbox = started();

    expect(sandbox.retireRun(RunId.of('run_2'), later(1_000))).toBe(sandbox);

    const retired = sandbox.retireRun(RunId.of('run_1'), later(1_000));

    expect(retired.current).toBe('draining');
    expect(retired.statusOn(reporting, NOW)).toBe('draining');
    expect(retired.keptBy(reporting)).toBe(false);
    expect(retired.leases).toEqual([]);
  });

  it('stays ready when a run retires it while another run holds it', () => {
    const shared = started().holdRun(RunId.of('run_2'), later(500));

    expect(
      shared
        .retireRun(RunId.of('run_1'), later(1_000))
        .statusOn(reporting, NOW),
    ).toBe('ready');
  });

  it('stays ready when a run retires it while an editor holds it', () => {
    const edited = started().holdEditor(editor('conn_1'), later(500));

    expect(
      edited
        .retireRun(RunId.of('run_1'), later(1_000))
        .statusOn(reporting, NOW),
    ).toBe('ready');
  });

  it('takes the next run on its host once ready and idle, and holds it', () => {
    const idle = started().releaseRun(RunId.of('run_1'), later(1_000));

    expect(idle.takesRunOn(reporting, NOW)).toBe(true);
    expect(
      idle.takesRunOn(
        aHost({ at: STARTED_AT, id: OTHER_HOST, sandboxes: ['sandbox_1'] }),
        NOW,
      ),
    ).toBe(false);
    expect(idle.takesRunOn(silent, NOW)).toBe(false);
    expect(started().takesRunOn(reporting, NOW)).toBe(false);
    expect(idle.drain().takesRunOn(reporting, NOW)).toBe(false);

    const held = idle.holdRun(RunId.of('run_2'), later(2_000));

    expect(held.holdsRun(RunId.of('run_2'))).toBe(true);
    expect(held.idleSince).toBeNull();
    expect(held.takesRunOn(reporting, NOW)).toBe(false);
    expect(held.holdRun(RunId.of('run_2'), later(3_000))).toBe(held);
  });

  it('takes the run of its own key and workspace only, on the host that reports it', () => {
    const idle = started().releaseRun(RunId.of('run_1'), later(1_000));
    const run = {
      runId: RunId.of('run_2'),
      workspaceId: WorkspaceId.of('ws_1'),
      key: SandboxKey.of('task-task_1'),
    };

    expect(
      idle.holdRunFor(run, reporting, later(2_000)).holdsRun(run.runId),
    ).toBe(true);
    expect(idle.holdRunFor(run, silent, later(2_000))).toBe(idle);
    expect(
      idle.holdRunFor(
        { ...run, key: SandboxKey.of('task-task_2') },
        reporting,
        later(2_000),
      ),
    ).toBe(idle);
    expect(
      idle.holdRunFor(
        { ...run, workspaceId: WorkspaceId.of('ws_2') },
        reporting,
        later(2_000),
      ),
    ).toBe(idle);
  });

  it('takes no run once it drains', () => {
    const draining = started()
      .releaseRun(RunId.of('run_1'), later(1_000))
      .drain();

    expect(() => draining.holdRun(RunId.of('run_2'), later(2_000))).toThrow(
      'cannot take run run_2',
    );
  });

  it('drains once it holds no lease for the grace, and not before', () => {
    const idle = started().releaseRun(RunId.of('run_1'), later(0));

    expect(idle.drainDue(DRAIN_POLICY, later(GRACE_MS - 1))).toBe(false);
    expect(idle.drainedWhenDue(DRAIN_POLICY, later(GRACE_MS - 1))).toBe(idle);
    expect(idle.drainedWhenDue(DRAIN_POLICY, later(GRACE_MS)).current).toBe(
      'draining',
    );
  });

  it('is kept by its host while open, and given up when idle on a host that stops, but not while a run holds it', () => {
    const held = started();
    const idle = held.releaseRun(RunId.of('run_1'), later(0));

    expect(held.keptBy(reporting)).toBe(true);
    expect(idle.keptBy(reporting)).toBe(true);
    expect(held.keptBy(stopping)).toBe(true);
    expect(idle.keptBy(stopping)).toBe(false);
    expect(idle.takesRunOn(stopping, NOW)).toBe(false);
    expect(idle.keptBy(aHost({ at: STARTED_AT, id: OTHER_HOST }))).toBe(false);
  });

  it('never drains while a run holds it', () => {
    const held = started();

    expect(held.drainDue(DRAIN_POLICY, later(EDITOR_LIMIT_MS * 2))).toBe(false);
  });

  it('drains when only editors held it past the editor limit after its last run', () => {
    const edited = withLeases(
      [SandboxLease.of(editor('person_1'), later(0))],
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
    expect(draining.lost(later(1)).drain().current).toBe('gone');
  });

  it('is gone once the host it is on stops reporting it, and ignores another host', () => {
    const gone = started().droppedBy(HOST, later(1_000));

    expect(gone.current).toBe('gone');
    expect(gone.goneAt).toEqual(later(1_000));
    expect(gone.isLive).toBe(false);
    expect(started().drain().droppedBy(HOST, later(1)).current).toBe('gone');
    expect(started().droppedBy(OTHER_HOST, later(1)).current).toBe('open');
  });

  it('gives a sandbox a minute to appear in its host’s report before it counts as gone', () => {
    expect(started().unreportedOn(silent, later(59_999)).current).toBe('open');
    expect(started().unreportedOn(silent, later(60_000)).current).toBe('gone');
    expect(started().unreportedOn(reporting, later(60_000)).current).toBe(
      'open',
    );
    expect(
      started().unreportedOn(
        aHost({ at: STARTED_AT, id: OTHER_HOST }),
        later(60_000),
      ).current,
    ).toBe('open');
  });

  it('is gone when its host goes silent, whatever its state', () => {
    expect(started().lost(later(1)).current).toBe('gone');
    expect(started().drain().lost(later(1)).current).toBe('gone');
  });

  it('cannot be idle while a run holds it', () => {
    expect(() =>
      withLeases(
        [SandboxLease.of(LeaseHolder.run(RunId.of('run_1')), later(0))],
        later(0),
      ),
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

      expect(sandbox.current).toBe('open');
      expect(sandbox.statusOn(null, NOW)).toBe('starting');
      expect(sandbox.isRequested).toBe(true);
      expect(sandbox.hostId).toBeNull();
      expect(sandbox.source).toBeNull();
      expect(sandbox.tokenHash).toBeNull();
      expect(sandbox.leases).toEqual([]);
      expect(sandbox.idleSince).toEqual(STARTED_AT);
      expect(
        sandbox.takesRunOn(
          aHost({ at: STARTED_AT, id: HOST, sandboxes: ['sandbox_r'] }),
          NOW,
        ),
      ).toBe(false);
    });

    it('starts on the host that claims it and becomes idle from then', () => {
      const pool = CredentialSource.ofId(aPullPool().id);
      const host = aHost({ at: STARTED_AT, id: HOST });
      const placed = requested().placeOn(
        host,
        tokenHashOf('token'),
        later(5_000),
      );

      expect(placed.isRequested).toBe(false);
      expect(placed.hostId?.equals(HOST)).toBe(true);
      expect(placed.source?.equals(pool)).toBe(true);
      expect(placed.startedAt).toEqual(later(5_000));
      expect(placed.idleSince).toEqual(later(5_000));
      expect(
        placed.takesRunOn(
          aHost({ at: STARTED_AT, id: HOST, sandboxes: ['sandbox_r'] }),
          NOW,
        ),
      ).toBe(true);
      expect(() =>
        placed.placeOn(host, tokenHashOf('token'), later(6_000)),
      ).toThrow(InconsistentStateError);
    });

    it('starts on no host of another workspace', () => {
      const elsewhere = Sandbox.request({
        id: SandboxId.of('sandbox_r'),
        workspaceId: WorkspaceId.of('ws_2'),
        key: SandboxKey.of('task-task_1'),
        at: STARTED_AT,
      });

      expect(() =>
        elsewhere.placeOn(
          aHost({ at: STARTED_AT, id: HOST }),
          tokenHashOf('token'),
          later(5_000),
        ),
      ).toThrow(UnknownHostError);
    });

    it('is lost, not drained, when no host claims it within the grace', () => {
      const sandbox = requested();

      expect(
        sandbox.drainedWhenDue(DRAIN_POLICY, later(GRACE_MS)).current,
      ).toBe('gone');
      expect(() => sandbox.drain()).toThrow(InconsistentStateError);
    });

    it('takes no run before a host starts it', () => {
      expect(() => requested().holdRun(RunId.of('run_1'), later(1))).toThrow(
        InconsistentStateError,
      );
    });

    it('cannot have a host without a token or a pool', () => {
      const sandbox = started();

      expect(() =>
        Sandbox.rehydrate({
          id: sandbox.id,
          workspaceId: sandbox.workspaceId,
          key: sandbox.key,
          hostId: sandbox.hostId,
          source: null,
          tokenHash: sandbox.tokenHash,
          state: sandbox.current,
          leases: sandbox.leases,
          idleSince: sandbox.idleSince,
          startedAt: sandbox.startedAt,
          goneAt: null,
          warm: null,
          version: 0,
        }),
      ).toThrow(InconsistentStateError);
      expect(() =>
        Sandbox.rehydrate({
          id: sandbox.id,
          workspaceId: sandbox.workspaceId,
          key: sandbox.key,
          hostId: sandbox.hostId,
          source: sandbox.source,
          tokenHash: null,
          state: sandbox.current,
          leases: sandbox.leases,
          idleSince: sandbox.idleSince,
          startedAt: sandbox.startedAt,
          goneAt: null,
          warm: null,
          version: 0,
        }),
      ).toThrow(InconsistentStateError);
    });
  });

  describe('held by editors', () => {
    const idle = () => started().releaseRun(RunId.of('run_1'), later(0));

    it('takes one lease per connection, renewed in place, and stays idle for runs', () => {
      const held = idle()
        .holdEditor(editor('conn_1'), later(1_000))
        .holdEditor(editor('conn_1'), later(31_000));

      expect(held.leases).toEqual([
        SandboxLease.of(editor('conn_1'), later(31_000)),
      ]);
      expect(held.idleSince).toEqual(later(0));
      expect(held.takesRunOn(reporting, NOW)).toBe(true);
    });

    it('gives an editor lease to editors only', () => {
      expect(() =>
        idle().holdEditor(LeaseHolder.run(RunId.of('run_2')), later(1_000)),
      ).toThrow(InconsistentStateError);
      expect(idle().holdsEditor(LeaseHolder.run(RunId.of('run_1')))).toBe(
        false,
      );
    });

    it('keeps its editors while a run holds it, and drops editor leases that expired', () => {
      const shared = started()
        .holdEditor(editor('conn_1'), later(0))
        .holdEditor(editor('conn_2'), later(EDITOR_LEASE_MS));

      const live = shared.withoutExpiredEditors(later(EDITOR_LEASE_MS));

      expect(live.holdsRun(RunId.of('run_1'))).toBe(true);
      expect(live.holdsEditor(editor('conn_1'))).toBe(false);
      expect(live.holdsEditor(editor('conn_2'))).toBe(true);
      expect(
        shared
          .releaseRun(RunId.of('run_1'), later(1))
          .holdsEditor(editor('conn_2')),
      ).toBe(true);
    });

    it('counts the grace from the moment its last editor leaves', () => {
      const left = idle()
        .holdEditor(editor('conn_1'), later(1_000))
        .releaseEditor(editor('conn_1'), later(GRACE_MS * 3));

      expect(left.leases).toEqual([]);
      expect(left.idleSince).toEqual(later(GRACE_MS * 3));
      expect(left.drainDue(DRAIN_POLICY, later(GRACE_MS * 4 - 1))).toBe(false);
      expect(left.drainDue(DRAIN_POLICY, later(GRACE_MS * 4))).toBe(true);
      expect(left.releaseEditor(editor('conn_1'), later(GRACE_MS * 5))).toBe(
        left,
      );
    });

    it('drops an editor lease nobody renewed, and then drains after the grace', () => {
      const forgotten = idle().holdEditor(editor('conn_1'), later(0));
      const expiry = later(EDITOR_LEASE_MS);

      expect(
        forgotten.drainedWhenDue(DRAIN_POLICY, later(EDITOR_LEASE_MS - 1)),
      ).toBe(forgotten);

      const dropped = forgotten.drainedWhenDue(DRAIN_POLICY, expiry);

      expect(dropped.leases).toEqual([]);
      expect(dropped.statusOn(reporting, NOW)).toBe('ready');
      expect(dropped.idleSince).toEqual(expiry);
      expect(
        dropped.drainedWhenDue(
          DRAIN_POLICY,
          new Date(expiry.getTime() + GRACE_MS),
        ).current,
      ).toBe('draining');
    });

    it('drains at the editor limit even while an editor renews its lease', () => {
      const renewed = idle().holdEditor(
        editor('conn_1'),
        later(EDITOR_LIMIT_MS - 1),
      );

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
      }).holdEditor(editor('conn_1'), later(1_000));

      expect(requested.holdsEditor(editor('conn_1'))).toBe(true);
      expect(
        Sandbox.rehydrate({
          id: requested.id,
          workspaceId: requested.workspaceId,
          key: requested.key,
          hostId: null,
          source: null,
          tokenHash: null,
          state: 'open',
          leases: requested.leases,
          idleSince: requested.idleSince,
          startedAt: requested.startedAt,
          goneAt: null,
          warm: null,
          version: 0,
        }).holdsEditor(editor('conn_1')),
      ).toBe(true);
    });

    it('takes no editor once it drains', () => {
      const drained = idle().drain();

      expect(drained.holdEditor(editor('conn_1'), later(1_000))).toBe(drained);
    });
  });

  describe('a warm sandbox', () => {
    const warmPart = WarmPart.of({
      lineId: LineId.of('line_1'),
      placement: RunnerPlacement.of(['gpu']),
      checkouts: [{ path: 'widgets', setup: 'npm ci' }],
      fingerprint: 'fingerprint_1',
    });
    const fitting = RunnerOffer.of(['gpu', 'linux']);
    const requested = () =>
      Sandbox.requestWarm({
        id: SandboxId.of('sandbox_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        warm: warmPart,
        at: STARTED_AT,
      });
    const placed = () =>
      requested().placeWarmOn(
        reporting,
        fitting,
        tokenHashOf('sandbox_1'),
        STARTED_AT,
      );
    const firstRun = {
      runId: RunId.of('run_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      key: SandboxKey.of('work/task-task_1'),
    };

    it('is requested with no key, no host and no lease', () => {
      const sandbox = requested();

      expect(sandbox.key).toBeNull();
      expect(sandbox.isRequested).toBe(true);
      expect(sandbox.isWarm).toBe(true);
      expect(sandbox.leases).toEqual([]);
      expect(sandbox.warm).toBe(warmPart);
    });

    it('starts only on a host that offers its placement', () => {
      expect(requested().warmFits(fitting)).toBe(true);
      expect(requested().warmFits(RunnerOffer.of(['linux']))).toBe(false);
      expect(() =>
        requested().placeWarmOn(
          reporting,
          RunnerOffer.of(['linux']),
          tokenHashOf('sandbox_1'),
          STARTED_AT,
        ),
      ).toThrow(InconsistentStateError);
      expect(() =>
        requested().placeOn(reporting, tokenHashOf('sandbox_1'), STARTED_AT),
      ).toThrow(InconsistentStateError);
      expect(placed().isOn(HOST)).toBe(true);
      expect(placed().isIdle).toBe(true);
    });

    it('takes a first run once ready, and the run’s key adopts it', () => {
      const adopted = placed().adoptFor(firstRun, reporting, NOW);

      expect(placed().takesFirstRunOn(reporting, NOW)).toBe(true);
      expect(adopted.key).toEqual(firstRun.key);
      expect(adopted.warm).toBeNull();
      expect(adopted.isWarm).toBe(false);
      expect(adopted.holdsRun(firstRun.runId)).toBe(true);
      expect(adopted.isIdle).toBe(false);
    });

    it('is adopted at most once, and never while it starts, by a keyless run or by another workspace', () => {
      const adopted = placed().adoptFor(firstRun, reporting, NOW);
      const again = adopted
        .releaseRun(firstRun.runId, later(2_000))
        .adoptFor(
          { ...firstRun, runId: RunId.of('run_2'), key: SandboxKey.of('x') },
          reporting,
          later(3_000),
        );

      expect(again.key).toEqual(firstRun.key);
      expect(again.holdsRun(RunId.of('run_2'))).toBe(false);
      expect(placed().adoptFor(firstRun, silent, NOW)).toEqual(placed());
      expect(
        placed().adoptFor({ ...firstRun, key: null }, reporting, NOW).key,
      ).toBeNull();
      expect(
        placed().adoptFor(
          { ...firstRun, workspaceId: WorkspaceId.of('ws_2') },
          reporting,
          NOW,
        ).isWarm,
      ).toBe(true);
    });

    it('takes no editor while it waits for its first run', () => {
      const sandbox = placed();

      expect(sandbox.holdEditor(editor('conn_1'), NOW)).toBe(sandbox);
    });

    it('stays past the idle grace, and drains at the warm age counted from its start', () => {
      const sandbox = placed();

      expect(sandbox.drainedWhenDue(DRAIN_POLICY, later(GRACE_MS * 2))).toBe(
        sandbox,
      );

      const drained = sandbox.drainedWhenDue(DRAIN_POLICY, later(WARM_AGE_MS));

      expect(drained.current).toBe('draining');
      expect(drained.warm).toBeNull();
      expect(drained.lost(later(WARM_AGE_MS + 1)).lostWhileWarm).toBe(false);
    });

    it('is lost, still warm, when it never reached a host before the warm age', () => {
      const lost = requested().drainedWhenDue(DRAIN_POLICY, later(WARM_AGE_MS));

      expect(lost.current).toBe('gone');
      expect(lost.lostWhileWarm).toBe(true);
    });

    it('counts as lost while warm when its host drops it before a run adopts it', () => {
      expect(placed().droppedBy(HOST, NOW).lostWhileWarm).toBe(true);
      expect(
        placed()
          .adoptFor(firstRun, reporting, NOW)
          .droppedBy(HOST, later(2_000)).lostWhileWarm,
      ).toBe(false);
    });

    it('cannot be warm with a key, a lease or while it drains', () => {
      const sandbox = placed();
      const state = {
        id: sandbox.id,
        workspaceId: sandbox.workspaceId,
        key: null,
        hostId: sandbox.hostId,
        source: sandbox.source,
        tokenHash: sandbox.tokenHash,
        state: sandbox.current,
        leases: sandbox.leases,
        idleSince: sandbox.idleSince,
        startedAt: sandbox.startedAt,
        goneAt: null,
        warm: warmPart,
        version: 0,
      };

      expect(Sandbox.rehydrate(state).isWarm).toBe(true);
      expect(() =>
        Sandbox.rehydrate({ ...state, key: SandboxKey.of('work/task-task_1') }),
      ).toThrow(InconsistentStateError);
      expect(() => Sandbox.rehydrate({ ...state, state: 'draining' })).toThrow(
        InconsistentStateError,
      );
      expect(() =>
        Sandbox.rehydrate({
          ...state,
          leases: [SandboxLease.of(editor('conn_1'), NOW)],
        }),
      ).toThrow(InconsistentStateError);
    });
  });
});
