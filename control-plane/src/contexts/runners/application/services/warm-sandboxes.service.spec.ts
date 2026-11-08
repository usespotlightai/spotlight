import { WarmSandboxes } from '@runners/application/services/warm-sandboxes.service';
import { aHost } from '@runners/domain/aggregates/runner-pool.fake-spec';
import {
  storedSandboxes,
  tokenHashOf,
} from '@runners/domain/aggregates/sandbox.fake-spec';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-08T12:00:00.000Z');

const later = (ms: number): Date => new Date(NOW.getTime() + ms);

const HOST = HostId.of('01J8ZQ4Y7N3K5V2W9X6RTBHCDE');

const ORDER = {
  workspaceId: 'ws_1',
  lineId: 'line_1',
  placement: { labelGroups: [['gpu']], image: null },
  checkouts: [{ path: 'widgets', setup: 'npm ci' }],
  shape: 'shape_1',
};

const keeping = () => {
  const { stored, sandboxes } = storedSandboxes();
  let next = 0;
  const service = new WarmSandboxes(
    sandboxes,
    { generate: () => `sandbox_w${++next}` },
    { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as LoggerPort,
  );
  const place = async (id: string) => {
    const found = stored.get(id);

    if (found) {
      await sandboxes.save(
        found.placeWarmOn(
          aHost({ id: HOST, at: NOW }),
          RunnerOffer.of(['gpu']),
          tokenHashOf(id),
          NOW,
        ),
      );
    }
  };

  return { stored, sandboxes, service, place };
};

describe('WarmSandboxes', () => {
  it('requests a warm sandbox for a line on no host, and lists it as kept with its shape', async () => {
    const { stored, service } = keeping();

    await service.request(ORDER, NOW);

    expect(stored.get('sandbox_w1')?.isRequested).toBe(true);
    expect(stored.get('sandbox_w1')?.warm?.checkouts).toEqual(ORDER.checkouts);
    expect(await service.kept()).toEqual([
      {
        id: 'sandbox_w1',
        workspaceId: 'ws_1',
        lineId: 'line_1',
        shape: 'shape_1',
      },
    ]);
  });

  it('removes a retired warm sandbox no host started, and drains one on a host', async () => {
    const { stored, service, place } = keeping();
    await service.request(ORDER, NOW);
    await service.request(ORDER, NOW);
    await place('sandbox_w2');

    await service.retire('sandbox_w1');
    await service.retire('sandbox_w2');

    expect(stored.has('sandbox_w1')).toBe(false);
    expect(stored.get('sandbox_w2')?.current).toBe('draining');
    expect(await service.kept()).toEqual([]);
  });

  it('names the lines whose warm sandbox was lost before a run adopted it, and not those it drained', async () => {
    const { stored, sandboxes, service, place } = keeping();
    await service.request(ORDER, NOW);
    await service.request({ ...ORDER, lineId: 'line_2' }, NOW);
    await place('sandbox_w1');
    await place('sandbox_w2');
    const lost = stored.get('sandbox_w1');
    if (lost) {
      await sandboxes.save(lost.droppedBy(HOST, later(1_000)));
    }
    await service.retire('sandbox_w2');
    const drained = stored.get('sandbox_w2');
    if (drained) {
      await sandboxes.save(drained.lost(later(2_000)));
    }

    expect(await service.linesLostSince(NOW)).toEqual(['line_1']);
    expect(await service.linesLostSince(later(5_000))).toEqual([]);
  });
});
