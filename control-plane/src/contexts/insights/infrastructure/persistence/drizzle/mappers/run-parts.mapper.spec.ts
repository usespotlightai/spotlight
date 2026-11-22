import { PersonAction } from '@insights/domain/value-objects/person-action.vo';
import {
  answerOf,
  decidingActionOf,
} from '@insights/infrastructure/persistence/drizzle/mappers/run-parts.mapper';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-11-18T09:00:00.000Z');

describe('decidingActionOf', () => {
  it('reads no deciding action from a row without one', () => {
    expect(
      decidingActionOf(
        {
          decidingAction: null,
          decidingActionAt: null,
          decidingActionBy: null,
        },
        'run record',
      ),
    ).toBeNull();
  });

  it('reads the action, its time and who acted', () => {
    expect(
      decidingActionOf(
        {
          decidingAction: 'accepted',
          decidingActionAt: AT,
          decidingActionBy: 'user_sam',
        },
        'run record',
      ),
    ).toEqual(PersonAction.of('accepted', AT, UserId.of('user_sam')));
  });

  it.each([
    {
      decidingAction: 'accepted' as const,
      decidingActionAt: AT,
      decidingActionBy: null,
    },
    {
      decidingAction: 'accepted' as const,
      decidingActionAt: null,
      decidingActionBy: 'user_sam',
    },
    {
      decidingAction: null,
      decidingActionAt: AT,
      decidingActionBy: 'user_sam',
    },
  ])('refuses a row with only part of its deciding action: %o', (row) => {
    expect(() => decidingActionOf(row, 'run fact')).toThrow(
      'A stored run fact has only part of its deciding action',
    );
  });
});

describe('answerOf', () => {
  it('reads no answer from a row without one', () => {
    expect(
      answerOf({ answeredAt: null, answeredBy: null }, 'run record'),
    ).toBeNull();
  });

  it('reads when it was answered and who answered', () => {
    expect(
      answerOf({ answeredAt: AT, answeredBy: 'user_sam' }, 'run record'),
    ).toEqual(PersonAction.of('answered', AT, UserId.of('user_sam')));
  });

  it.each([
    { answeredAt: AT, answeredBy: null },
    { answeredAt: null, answeredBy: 'user_sam' },
  ])('refuses a row with only part of its answer: %o', (row) => {
    expect(() => answerOf(row, 'run fact')).toThrow(
      'A stored run fact has only part of its answer',
    );
  });
});
