import {
  aHost,
  aRunner,
  HOST_ID,
  STARTED_AT,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import {
  aSandbox,
  tokenHashOf,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import { HostSlotHolders } from '@runners/domain/services/host-slot-holders';
import { WarmSlots } from '@runners/domain/services/warm-slots';
import { LeaseHolder } from '@runners/domain/value-objects/lease-holder.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { WarmPart } from '@runners/domain/value-objects/warm-part.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date(STARTED_AT.getTime() + 1_000);

const earlier = (ms: number): Date => new Date(NOW.getTime() - ms);

const HOST = HOST_ID;

const WARM = WarmPart.of({
  lineId: LineId.of('line_1'),
  placement: RunnerPlacement.of(['gpu']),
  checkouts: [{ path: 'widgets', setup: 'npm ci' }],
  fingerprint: 'fingerprint_1',
});

const hostReporting = (...sandboxes: string[]) =>
  aHost({ id: HOST, at: NOW, sandboxes });

const warmOn = (id: string, requestedAt = NOW): Sandbox =>
  Sandbox.requestWarm({
    id: SandboxId.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    warm: WARM,
    at: requestedAt,
  }).placeWarmOn(
    hostReporting(),
    RunnerOffer.of(['gpu']),
    tokenHashOf(id),
    requestedAt,
  );

const busy = (id: string): Sandbox =>
  aSandbox({ id, workspaceId: WorkspaceId.of('ws_1'), hostId: HOST, at: NOW });

const idleSince = (id: string, at: Date): Sandbox =>
  busy(id).releaseRun(RunId.of('run_1'), at);

const working = (id: string): Runner =>
  aRunner({ id }).claim(RunnerWork.run(`run_of_${id}`), NOW);

const claiming = (id: string): Runner => aRunner({ id });

const held = (alive: readonly Runner[], live: readonly Sandbox[] = []) =>
  HostSlotHolders.on(
    HOST,
    alive,
    live.filter((each) => each.isIdle).map((each) => each.id),
    NOW,
  );

describe('WarmSlots', () => {
  it('has room for a warm sandbox only while a slot stays free past the one the claim holds', () => {
    const host = hostReporting();

    expect(
      WarmSlots.roomForWarm(
        host,
        held([working('r1'), working('r2'), claiming('c1')]),
      ),
    ).toBe(true);
    expect(
      WarmSlots.roomForWarm(
        host,
        held([working('r1'), working('r2'), working('r3')]),
      ),
    ).toBe(false);
  });

  it('drains the oldest ready warm sandbox once its host has no free slot', () => {
    const live = [
      warmOn('sandbox_w2', earlier(1_000)),
      warmOn('sandbox_w1', earlier(2_000)),
      warmOn('sandbox_w3', earlier(1_000)),
      busy('sandbox_run'),
    ];
    const host = hostReporting(...live.map((each) => each.id.value));

    expect(
      WarmSlots.toDrainForQueuedRun(
        host,
        held([working('r1')], live),
        live,
        NOW,
      )?.id.value,
    ).toBe('sandbox_w1');
  });

  it('drains the sandbox idle the longest once its host has no free slot and holds no warm one', () => {
    const live = [
      idleSince('sandbox_i1', earlier(500)),
      idleSince('sandbox_i2', earlier(900)),
      busy('sandbox_run'),
    ];
    const host = hostReporting(...live.map((each) => each.id.value));

    expect(
      WarmSlots.toDrainForQueuedRun(
        host,
        held([working('r1'), working('r2')], live),
        live,
        NOW,
      )?.id.value,
    ).toBe('sandbox_i2');
  });

  it('drains a warm sandbox before an idle one, and never one an editor holds', () => {
    const edited = idleSince('sandbox_i1', earlier(900)).holdEditor(
      LeaseHolder.editor('conn_1'),
      NOW,
    );
    const live = [warmOn('sandbox_w1'), edited, busy('sandbox_run')];
    const host = hostReporting(...live.map((each) => each.id.value));
    const holders = held([working('r1'), working('r2')], live);

    expect(
      WarmSlots.toDrainForQueuedRun(host, holders, live, NOW)?.id.value,
    ).toBe('sandbox_w1');
    expect(
      WarmSlots.toDrainForQueuedRun(host, holders, live.slice(1), NOW),
    ).toBeNull();
  });

  it('drains nothing while its host has a free slot', () => {
    const live = [warmOn('sandbox_w1'), warmOn('sandbox_w2')];
    const host = hostReporting('sandbox_w1', 'sandbox_w2');

    expect(
      WarmSlots.toDrainForQueuedRun(
        host,
        held([working('r1')], live),
        live,
        NOW,
      ),
    ).toBeNull();
  });

  it('counts a host claim that waits for work as a free slot', () => {
    const live = [warmOn('sandbox_w1'), warmOn('sandbox_w2')];
    const host = hostReporting('sandbox_w1', 'sandbox_w2');

    expect(
      WarmSlots.toDrainForQueuedRun(
        host,
        held([working('r1'), claiming('c1')], live),
        live,
        NOW,
      ),
    ).toBeNull();
    expect(
      WarmSlots.toDrainForQueuedRun(
        host,
        held([working('r1'), working('r2')], live),
        live,
        NOW,
      )?.id.value,
    ).toBe('sandbox_w1');
  });

  it('drains nothing more while a sandbox on its host drains', () => {
    const live = [
      warmOn('sandbox_w1'),
      warmOn('sandbox_w2'),
      warmOn('sandbox_w3').drain(),
    ];
    const host = hostReporting(...live.map((each) => each.id.value));

    expect(
      WarmSlots.toDrainForQueuedRun(
        host,
        held([working('r1')], live),
        live,
        NOW,
      ),
    ).toBeNull();
  });

  it('drains only a warm sandbox its host reports, never one that holds a run', () => {
    const live = [
      warmOn('sandbox_w1'),
      busy('sandbox_run_1'),
      busy('sandbox_run_2'),
    ];
    const host = hostReporting('sandbox_run_1', 'sandbox_run_2');

    expect(
      WarmSlots.toDrainForQueuedRun(
        host,
        held([working('r1'), working('r2'), working('r3')], live),
        live,
        NOW,
      ),
    ).toBeNull();
  });
});
