import { HostWarmSlots } from '@runners/application/services/host-warm-slots.service';
import {
  aHost,
  aRunner,
  storedHosts,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import {
  storedSandboxes,
  tokenHashOf,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { WarmPart } from '@runners/domain/value-objects/warm-part.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
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

const slotsOn = (input: {
  warm: readonly string[];
  alive: readonly Runner[];
}) => {
  const placed = input.warm.map((id, at) =>
    warm(id, new Date(NOW.getTime() - 10_000 + at * 1_000)),
  );
  const { stored, sandboxes } = storedSandboxes({}, ...placed);
  const { hosts } = storedHosts(
    aHost({ id: HOST, at: NOW, sandboxes: [...input.warm] }),
  );
  const runners = {
    aliveInWorkspace: vi.fn(async () => input.alive),
  } as unknown as RunnerRepository;
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const slots = new HostWarmSlots(
    sandboxes,
    hosts,
    runners,
    logger as unknown as LoggerPort,
  );

  return { slots, stored, logger };
};

describe('HostWarmSlots', () => {
  it('has room for a warm sandbox while another slot of the host stays free', async () => {
    const claiming = aRunner({ id: 'claiming_1' });

    expect(
      await slotsOn({
        warm: ['sandbox_w1', 'sandbox_w2'],
        alive: [claiming],
      }).slots.roomForWarmOn(HOST.value, NOW),
    ).toBe(true);
    expect(
      await slotsOn({
        warm: ['sandbox_w1', 'sandbox_w2', 'sandbox_w3'],
        alive: [claiming],
      }).slots.roomForWarmOn(HOST.value, NOW),
    ).toBe(false);
  });

  it('counts a warm sandbox once while a runner waits in it for a run', async () => {
    expect(
      await slotsOn({
        warm: ['sandbox_w1', 'sandbox_w2'],
        alive: [
          aRunner({ id: 'claiming_1' }),
          aRunner({ id: 'waiting_1', enters: 'sandbox_w1' }),
        ],
      }).slots.roomForWarmOn(HOST.value, NOW),
    ).toBe(true);
  });

  it('drains the oldest warm sandbox of a full host, one at a time', async () => {
    const { slots, stored, logger } = slotsOn({
      warm: ['sandbox_w1', 'sandbox_w2', 'sandbox_w3'],
      alive: [running('running_1')],
    });

    await slots.drainWarmOn(HOST.value, NOW);
    await slots.drainWarmOn(HOST.value, NOW);

    expect(stored.get('sandbox_w1')?.current).toBe('draining');
    expect(stored.get('sandbox_w2')?.isWarm).toBe(true);
    expect(stored.get('sandbox_w3')?.isWarm).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('drains nothing while the host offers a slot through a claim that waits for work', async () => {
    const { slots, stored } = slotsOn({
      warm: ['sandbox_w1', 'sandbox_w2', 'sandbox_w3'],
      alive: [aRunner({ id: 'claiming_1' })],
    });

    await slots.drainWarmOn(HOST.value, NOW);

    expect(stored.get('sandbox_w1')?.isWarm).toBe(true);
  });

  it('drains nothing while the host has a free slot, or on a host it does not know', async () => {
    const { slots, stored } = slotsOn({
      warm: ['sandbox_w1', 'sandbox_w2'],
      alive: [running('running_1')],
    });

    await slots.drainWarmOn(HOST.value, NOW);
    await slots.drainWarmOn('01J8ZQ4Y7N3K5V2W9X6RTBHCDF', NOW);

    expect(await slots.roomForWarmOn('01J8ZQ4Y7N3K5V2W9X6RTBHCDF', NOW)).toBe(
      false,
    );
    expect(stored.get('sandbox_w1')?.isWarm).toBe(true);
  });
});
