import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRunners } from '@change-review/infrastructure/acl/check-runners.adapter';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { CheckEndingsPort } from '@work/application/ports/check-endings.port';
import { describe, expect, it, vi } from 'vitest';

describe('CheckRunners', () => {
  it('tells Work the check it handed a runner has ended', async () => {
    const checkEnded = vi.fn(async () => {});

    await new CheckRunners({
      checkEnded,
    } as unknown as CheckEndingsPort).released(ChangeStackId.of('stack_1'));

    expect(checkEnded).toHaveBeenCalledWith('stack_1');
  });

  it('tells Work to release a runner whose reservation was dropped', async () => {
    const reservationDropped = vi.fn(async () => {});

    await new CheckRunners({
      reservationDropped,
    } as unknown as CheckEndingsPort).reservationDropped(
      RunnerId.of('pooled_1'),
    );

    expect(reservationDropped).toHaveBeenCalledWith('pooled_1');
  });
});
