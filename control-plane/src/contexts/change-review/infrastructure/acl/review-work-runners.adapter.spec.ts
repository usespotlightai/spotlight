import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { ReviewWorkRunners } from '@change-review/infrastructure/acl/review-work-runners.adapter';
import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-24T12:00:00.000Z');
const clock = { now: () => NOW } as ClockPort;

describe('ReviewWorkRunners', () => {
  it('tells the pools the check it handed a runner has ended', async () => {
    const workEnded = vi.fn(async () => {});

    await new ReviewWorkRunners(
      { workEnded } as unknown as RunnersPort,
      clock,
    ).checkReleased(ChangeStackId.of('stack_1'));

    expect(workEnded).toHaveBeenCalledWith(
      { kind: 'check', id: 'stack_1' },
      NOW,
    );
  });

  it('ends the runner of a check at the time the check ended, where it is known', async () => {
    const workEnded = vi.fn(async () => {});
    const at = new Date(NOW.getTime() - 60_000);

    await new ReviewWorkRunners(
      { workEnded } as unknown as RunnersPort,
      clock,
    ).checkReleased(ChangeStackId.of('stack_1'), at);

    expect(workEnded).toHaveBeenCalledWith(
      { kind: 'check', id: 'stack_1' },
      at,
    );
  });

  it('tells the pools to release a runner whose reservation was dropped', async () => {
    const reservationDropped = vi.fn(async () => {});

    await new ReviewWorkRunners(
      { reservationDropped } as unknown as RunnersPort,
      clock,
    ).reservationDropped(RunnerId.of('pooled_1'));

    expect(reservationDropped).toHaveBeenCalledWith(
      RunnerId.of('pooled_1'),
      NOW,
    );
  });
});
