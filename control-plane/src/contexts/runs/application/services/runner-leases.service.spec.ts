import type { RunnersPort } from '@runners/application/ports/runners.port';
import { RunnerLeases } from '@runs/application/services/runner-leases.service';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-24T12:00:00.000Z');

const ending = () => {
  const workEnded = vi.fn(async () => {});
  const release = vi.fn(async () => {});
  const claim = vi.fn(async () => {});
  const reservationDropped = vi.fn(async () => {});

  return {
    workEnded,
    release,
    claim,
    reservationDropped,
    endings: new RunnerLeases(
      partial<RunnersPort>({
        workEnded,
        release,
        claim,
        reservationDropped,
      }),
      partial<ClockPort>({ now: () => NOW }),
    ),
  };
};

describe('RunnerLeases', () => {
  it('tells the pools a run has ended, at the time the run ended', async () => {
    const { endings, workEnded } = ending();
    const endedAt = new Date(NOW.getTime() - 60_000);

    await endings.runEnded(RunId.of('run_1'), endedAt);

    expect(workEnded).toHaveBeenCalledWith(
      { kind: 'run', id: 'run_1' },
      endedAt,
    );
  });

  it('tells the pools a runner’s reservation was dropped', async () => {
    const { endings, reservationDropped } = ending();

    await endings.reservationDropped('pooled_1');

    expect(reservationDropped).toHaveBeenCalledWith(
      RunnerId.of('pooled_1'),
      NOW,
    );
  });

  it('releases the runner whose lease on a run expired', async () => {
    const { endings, release } = ending();
    const expiredAt = new Date('2026-09-24T11:59:00.000Z');

    await endings.runLeft(RunnerId.of('runner_1'), expiredAt);

    expect(release).toHaveBeenCalledWith(RunnerId.of('runner_1'), expiredAt);
  });
});
