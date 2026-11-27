import type { HostSlotLocksPort } from '@runners/application/ports/host-slot-locks.port';
import { HostWarmSlots } from '@runners/application/services/host-warm-slots.service';
import {
  aHost,
  aRunner,
  storedHosts,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import {
  aSandbox,
  storedSandboxes,
  tokenHashOf,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { WarmPart } from '@runners/domain/value-objects/warm-part.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-24T10:00:30.000Z');

const HOST = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');

const WARM = WarmPart.of({
  lineId: LineId.of('line_1'),
  placement: RunnerPlacement.of(['gpu']),
  checkouts: [{ path: 'widgets', setup: 'npm ci' }],
  fingerprint: 'fingerprint_1',
});

const warm = (id: string, requestedAt: Date): Sandbox =>
  Sandbox.requestWarm({
    id: SandboxId.of(id),
    workspaceId: WorkspaceId.of('ws_1'),
    warm: WARM,
    at: requestedAt,
  }).placeWarmOn(
    aHost({ id: HOST, at: NOW }),
    RunnerOffer.of(['gpu']),
    tokenHashOf(id),
    requestedAt,
  );

const running = (id: string): Runner =>
  aRunner({ id }).claim(RunnerWork.run(`run_of_${id}`), NOW);

const idle = (id: string, idleAt: Date): Sandbox =>
  aSandbox({
    id,
    workspaceId: WorkspaceId.of('ws_1'),
    hostId: HOST,
    at: new Date(NOW.getTime() - 20_000),
  }).releaseRun(RunId.of('run_1'), idleAt);

const slotsOn = (input: {
  warm: readonly string[];
  idle?: readonly Sandbox[];
  alive: readonly Runner[];
}) => {
  const placed = input.warm.map((id, at) =>
    warm(id, new Date(NOW.getTime() - 10_000 + at * 1_000)),
  );
  const kept = input.idle ?? [];
  const { stored, sandboxes } = storedSandboxes({}, ...placed, ...kept);
  const { hosts } = storedHosts(
    aHost({
      id: HOST,
      at: NOW,
      sandboxes: [...input.warm, ...kept.map((each) => each.id.value)],
    }),
  );
  const runners = partial<RunnerRepository>({
    aliveInWorkspace: vi.fn(async () => input.alive),
  });
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const held: string[] = [];
  const locks: HostSlotLocksPort = {
    holding: async (hostId, work) => {
      held.push(hostId);
      return work();
    },
  };
  const slots = new HostWarmSlots(
    sandboxes,
    hosts,
    runners,
    locks,
    partial<LoggerPort>(logger),
  );

  return { slots, stored, logger, held };
};

const started = (slots: HostWarmSlots, host: string) =>
  slots.startWarmIfRoomOn(host, NOW, async () => 'started');

const aRunWaits = async () => true;

describe('HostWarmSlots', () => {
  it('has room for a warm sandbox while another slot of the host stays free', async () => {
    const claiming = aRunner({ id: 'claiming_1' });

    expect(
      await started(
        slotsOn({
          warm: ['sandbox_w1', 'sandbox_w2'],
          alive: [claiming],
        }).slots,
        HOST.value,
      ),
    ).toBe('started');
    expect(
      await started(
        slotsOn({
          warm: ['sandbox_w1', 'sandbox_w2', 'sandbox_w3'],
          alive: [claiming],
        }).slots,
        HOST.value,
      ),
    ).toBeNull();
  });

  it('counts a warm sandbox once while a runner waits in it for a run', async () => {
    expect(
      await started(
        slotsOn({
          warm: ['sandbox_w1', 'sandbox_w2'],
          alive: [
            aRunner({ id: 'claiming_1' }),
            aRunner({ id: 'waiting_1', enters: 'sandbox_w1' }),
          ],
        }).slots,
        HOST.value,
      ),
    ).toBe('started');
  });

  it('drains the oldest warm sandbox of a full host, one at a time', async () => {
    const { slots, stored, logger } = slotsOn({
      warm: ['sandbox_w1', 'sandbox_w2', 'sandbox_w3'],
      alive: [running('running_1')],
    });

    await slots.drainIdleOn(HOST.value, NOW, aRunWaits);
    await slots.drainIdleOn(HOST.value, NOW, aRunWaits);

    expect(stored.get('sandbox_w1')?.current).toBe('draining');
    expect(stored.get('sandbox_w2')?.isWarm).toBe(true);
    expect(stored.get('sandbox_w3')?.isWarm).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('drains the sandbox idle the longest on a full host with no warm sandbox, one at a time', async () => {
    const { slots, stored, logger } = slotsOn({
      warm: [],
      idle: [
        idle('sandbox_i1', new Date(NOW.getTime() - 5_000)),
        idle('sandbox_i2', new Date(NOW.getTime() - 15_000)),
        idle('sandbox_i3', new Date(NOW.getTime() - 10_000)),
      ],
      alive: [running('running_1')],
    });

    await slots.drainIdleOn(HOST.value, NOW, aRunWaits);
    await slots.drainIdleOn(HOST.value, NOW, aRunWaits);

    expect(stored.get('sandbox_i2')?.current).toBe('draining');
    expect(stored.get('sandbox_i1')?.current).toBe('open');
    expect(stored.get('sandbox_i3')?.current).toBe('open');
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ sandboxId: 'sandbox_i2', lineId: null }),
      'Draining an idle sandbox early so a queued run can take its slot',
    );
  });

  it('drains nothing while the host offers a slot through a claim that waits for work', async () => {
    const { slots, stored } = slotsOn({
      warm: ['sandbox_w1', 'sandbox_w2', 'sandbox_w3'],
      alive: [aRunner({ id: 'claiming_1' })],
    });

    await slots.drainIdleOn(HOST.value, NOW, aRunWaits);

    expect(stored.get('sandbox_w1')?.isWarm).toBe(true);
  });

  it('drains nothing while the host has a free slot, or on a host it does not know', async () => {
    const { slots, stored } = slotsOn({
      warm: ['sandbox_w1', 'sandbox_w2'],
      alive: [running('running_1')],
    });

    await slots.drainIdleOn(HOST.value, NOW, aRunWaits);
    await slots.drainIdleOn('01J8ZQ4Y7N3K5V2W9X6RTBHCDF', NOW, aRunWaits);

    expect(await started(slots, '01J8ZQ4Y7N3K5V2W9X6RTBHCDF')).toBeNull();
    expect(stored.get('sandbox_w1')?.isWarm).toBe(true);
  });

  it('starts a warm sandbox and drains one while it holds the host’s slot lock', async () => {
    const { slots, held } = slotsOn({
      warm: ['sandbox_w1', 'sandbox_w2', 'sandbox_w3'],
      alive: [running('running_1')],
    });

    await started(slots, HOST.value);
    await slots.drainIdleOn(HOST.value, NOW, aRunWaits);

    expect(held).toEqual([HOST.value, HOST.value]);
  });

  it('asks whether a run waits only when it would drain, and drains nothing when none waits', async () => {
    const full = slotsOn({
      warm: ['sandbox_w1', 'sandbox_w2', 'sandbox_w3'],
      alive: [running('running_1')],
    });
    const free = slotsOn({
      warm: ['sandbox_w1', 'sandbox_w2'],
      alive: [running('running_1')],
    });
    const runWaits = vi.fn(async () => false);

    await free.slots.drainIdleOn(HOST.value, NOW, runWaits);

    expect(runWaits).not.toHaveBeenCalled();

    await full.slots.drainIdleOn(HOST.value, NOW, runWaits);

    expect(runWaits).toHaveBeenCalledTimes(1);
    expect(full.stored.get('sandbox_w1')?.isWarm).toBe(true);
    expect(full.held).toEqual([]);
  });
});
