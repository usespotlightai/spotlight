import {
  chatOf,
  day,
  historyOf,
  humanActionsOf,
} from '@insights/domain/insights.fake-spec';
import {
  adoptionCountsOf,
  adoptionFrom,
} from '@insights/domain/services/adoption';
import type { TeamHistory } from '@insights/domain/services/team-history';
import { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of('7d', new Date('2026-10-01T15:00:00.000Z'));

const adoptionOf = (
  history: TeamHistory,
  period: InsightsPeriod,
  firstSeen: ReadonlyMap<string, Date>,
) => adoptionFrom(adoptionCountsOf(history, period), period, firstSeen);

const history = historyOf({
  taskHumanActions: [
    humanActionsOf('task_1', {
      openedBy: 'user_ada',
      openedAt: day('2026-09-26'),
      actions: [
        ['answered', 'user_bob', 'station_1', day('2026-09-27')],
        ['accepted', 'user_bob', 'station_1', day('2026-09-10')],
      ],
    }),
    humanActionsOf('task_2', {
      openedBy: 'user_dee',
      openedAt: day('2026-09-20'),
    }),
  ],
  chats: [
    chatOf('chat_1', 'user_cy', day('2026-09-30')),
    chatOf('chat_2', 'user_eve', day('2026-09-05')),
  ],
});

describe('adoptionFrom the counts of adoptionCountsOf', () => {
  it('counts who was active this period, the one before, this week and this month', () => {
    const adoption = adoptionOf(history, PERIOD, new Map());

    expect(adoption.activeCount).toBe(3);
    expect(adoption.people.map((each) => each.personId)).toEqual([
      'user_ada',
      'user_bob',
      'user_cy',
    ]);
    expect(adoption.activeChange).toMatchObject({
      unit: 'percent',
      by: 2,
      direction: 'up',
      tone: 'good',
    });
    expect(adoption.weeklyCount).toBe(3);
    expect(adoption.monthlyCount).toBe(5);
    expect(adoption.stickiness).toBe(0.6);
  });

  it('calls someone new whose first activity on the team falls in the period', () => {
    const adoption = adoptionOf(
      history,
      PERIOD,
      new Map([['user_cy', day('2026-01-01')]]),
    );

    expect(adoption.newAdopterCount).toBe(1);
    expect(
      adoption.people.filter((each) => each.isNew).map((each) => each.personId),
    ).toEqual(['user_ada']);
    expect(
      adoption.people.find((each) => each.personId === 'user_bob'),
    ).toMatchObject({
      actions: 1,
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
