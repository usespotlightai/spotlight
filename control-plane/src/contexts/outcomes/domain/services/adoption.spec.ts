import {
  chatOf,
  day,
  historyOf,
  touchesOf,
} from '@outcomes/domain/insights.fake-spec';
import { adoptionOf } from '@outcomes/domain/services/adoption';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of('7d', new Date('2026-10-01T15:00:00.000Z'));

const history = historyOf({
  touches: [
    touchesOf('task_1', {
      openedBy: 'user_ada',
      openedAt: day('2026-09-26'),
      acts: [
        ['answered', 'user_bob', 'station_1', day('2026-09-27')],
        ['closed', 'user_bob', 'station_1', day('2026-09-10')],
      ],
    }),
    touchesOf('task_2', { openedBy: 'user_dee', openedAt: day('2026-09-20') }),
  ],
  chats: [
    chatOf('chat_1', 'user_cy', day('2026-09-30')),
    chatOf('chat_2', 'user_eve', day('2026-09-05')),
  ],
});

describe('adoptionOf', () => {
  it('counts who was active this period, the one before, this week and this month', () => {
    const adoption = adoptionOf(history, PERIOD, new Map());

    expect(adoption.active).toEqual(['user_ada', 'user_bob', 'user_cy']);
    expect(adoption.activeBefore).toEqual(['user_dee']);
    expect(adoption.weekly).toEqual(['user_ada', 'user_bob', 'user_cy']);
    expect(adoption.monthly).toEqual([
      'user_ada',
      'user_bob',
      'user_cy',
      'user_dee',
      'user_eve',
    ]);
    expect(adoption.stickiness).toBe(0.6);
  });

  it('calls someone new whose first activity on the team falls in the period', () => {
    const adoption = adoptionOf(
      history,
      PERIOD,
      new Map([['user_cy', day('2026-01-01')]]),
    );

    expect(adoption.newAdopters).toEqual(['user_ada']);
    expect(
      adoption.people.find((each) => each.personId === 'user_bob'),
    ).toMatchObject({
      acts: 1,
      tasksOpened: 0,
      firstSeenAt: day('2026-09-10'),
      lastActiveAt: day('2026-09-27'),
      isNew: false,
    });
  });

  it('has no stickiness without monthly use', () => {
    expect(adoptionOf(historyOf({}), PERIOD, new Map()).stickiness).toBeNull();
  });
});
