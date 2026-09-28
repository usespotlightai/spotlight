import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerHolds } from '@work/application/services/runner-holds.service';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-24T12:00:00.000Z');

const ending = () => {
  const workEnded = vi.fn(async () => {});
  const letGo = vi.fn(async () => {});
  const took = vi.fn(async () => {});
  const reservationDropped = vi.fn(async () => {});

  return {
    workEnded,
    letGo,
    took,
    reservationDropped,
    endings: new RunnerHolds(
      { workEnded, letGo, took, reservationDropped } as unknown as RunnersPort,
      { now: () => NOW } as ClockPort,
    ),
  };
};

describe('RunnerHolds', () => {
  it('tells the pools a run has ended', async () => {
    const { endings, workEnded } = ending();

    await endings.runEnded(RunId.of('run_1'));

    expect(workEnded).toHaveBeenCalledWith({ kind: 'run', id: 'run_1' }, NOW);
  });

  it('tells the pools a check has ended', async () => {
    const { endings, workEnded } = ending();

    await endings.checkEnded('stack_1');

    expect(workEnded).toHaveBeenCalledWith(
      { kind: 'check', id: 'stack_1' },
      NOW,
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

  it('lets go of the runner a run lapsed on', async () => {
    const { endings, letGo } = ending();
    const lapsedAt = new Date('2026-09-24T11:59:00.000Z');

    await endings.runLapsed(RunnerId.of('runner_1'), lapsedAt);

    expect(letGo).toHaveBeenCalledWith(RunnerId.of('runner_1'), lapsedAt);
  });
});
