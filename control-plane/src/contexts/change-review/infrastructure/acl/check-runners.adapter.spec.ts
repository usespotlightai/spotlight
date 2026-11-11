import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRunners } from '@change-review/infrastructure/acl/check-runners.adapter';
import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-24T12:00:00.000Z');
const clock = { now: () => NOW } as ClockPort;

describe('CheckRunners', () => {
  it('tells the pools the check it handed a runner has ended', async () => {
    const workEnded = vi.fn(async () => {});

    await new CheckRunners(
      { workEnded } as unknown as RunnersPort,
      clock,
    ).released(ChangeStackId.of('stack_1'));

    expect(workEnded).toHaveBeenCalledWith(
      { kind: 'check', id: 'stack_1' },
      NOW,
    );
  });

  it('tells the pools to release a runner whose reservation was dropped', async () => {
    const reservationDropped = vi.fn(async () => {});

    await new CheckRunners(
      { reservationDropped } as unknown as RunnersPort,
      clock,
    ).reservationDropped(RunnerId.of('pooled_1'));

    expect(reservationDropped).toHaveBeenCalledWith(
      RunnerId.of('pooled_1'),
      NOW,
    );
  });
});
