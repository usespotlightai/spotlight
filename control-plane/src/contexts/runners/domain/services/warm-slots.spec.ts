import { aHost } from '@runners/domain/aggregates/runner-pool.fake-spec';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import {
  aSandbox,
  tokenHashOf,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import { WarmSlots } from '@runners/domain/services/warm-slots';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';
import { WarmPart } from '@runners/domain/value-objects/warm-part.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-14T12:00:00.000Z');

const earlier = (ms: number): Date => new Date(NOW.getTime() - ms);

const HOST = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');

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

const occupied = (runners: number, idle: readonly Sandbox[]) =>
  PoolOccupancy.of({
    runners,
    entered: [],
    idleSandboxes: idle.filter((each) => each.isIdle).map((each) => each.id),
  });

describe('WarmSlots', () => {
  it('has room for a warm sandbox only while a slot stays free past the one the claim holds', () => {
    const host = hostReporting();

    expect(WarmSlots.roomForWarm(host, occupied(3, []))).toBe(true);
    expect(WarmSlots.roomForWarm(host, occupied(4, []))).toBe(false);
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
      WarmSlots.toDrainForQueuedRun(host, occupied(1, live), 0, live, NOW)?.id
        .value,
    ).toBe('sandbox_w1');
  });

  it('drains nothing while its host has a free slot', () => {
    const live = [warmOn('sandbox_w1'), warmOn('sandbox_w2')];
    const host = hostReporting('sandbox_w1', 'sandbox_w2');

    expect(
      WarmSlots.toDrainForQueuedRun(host, occupied(1, live), 0, live, NOW),
    ).toBeNull();
  });

  it('counts a host claim that waits for work as a free slot', () => {
    const live = [warmOn('sandbox_w1'), warmOn('sandbox_w2')];
    const host = hostReporting('sandbox_w1', 'sandbox_w2');

    expect(
      WarmSlots.toDrainForQueuedRun(host, occupied(2, live), 1, live, NOW),
    ).toBeNull();
    expect(
      WarmSlots.toDrainForQueuedRun(host, occupied(2, live), 0, live, NOW)?.id
        .value,
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
      WarmSlots.toDrainForQueuedRun(host, occupied(1, live), 0, live, NOW),
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
      WarmSlots.toDrainForQueuedRun(host, occupied(3, live), 0, live, NOW),
    ).toBeNull();
  });
});
