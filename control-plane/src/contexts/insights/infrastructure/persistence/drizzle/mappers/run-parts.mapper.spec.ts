import { HumanAction } from '@insights/domain/value-objects/human-action.vo';
import { firstHumanActionOf } from '@insights/infrastructure/persistence/drizzle/mappers/run-parts.mapper';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-11-18T09:00:00.000Z');

describe('firstHumanActionOf', () => {
  it('reads no first human action from a row without one', () => {
    expect(
      firstHumanActionOf(
        {
          firstHumanAction: null,
          firstHumanActionAt: null,
          firstHumanActionBy: null,
        },
        'run record',
      ),
    ).toBeNull();
  });

  it('reads the action, its time and who acted', () => {
    expect(
      firstHumanActionOf(
        {
          firstHumanAction: 'accepted',
          firstHumanActionAt: AT,
          firstHumanActionBy: 'user_sam',
        },
        'run record',
      ),
    ).toEqual(HumanAction.of('accepted', AT, UserId.of('user_sam')));
  });

  it.each([
    {
      firstHumanAction: 'accepted' as const,
      firstHumanActionAt: AT,
      firstHumanActionBy: null,
    },
    {
      firstHumanAction: 'accepted' as const,
      firstHumanActionAt: null,
      firstHumanActionBy: 'user_sam',
    },
    {
      firstHumanAction: null,
      firstHumanActionAt: AT,
      firstHumanActionBy: 'user_sam',
    },
  ])('refuses a row with only part of its first human action: %o', (row) => {
    expect(() => firstHumanActionOf(row, 'run fact')).toThrow(
      'A stored run fact has only part of its first human action',
    );
  });
});
