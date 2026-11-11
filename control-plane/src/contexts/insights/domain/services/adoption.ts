import { type Delta, deltaOf } from '@insights/domain/value-objects/delta.vo';
import {
  type InsightsPeriod,
  within,
} from '@insights/domain/value-objects/insights-period.vo';

interface PersonUse {
  readonly personId: string;
  readonly tasksOpened: number;
  readonly actions: number;
  readonly chats: number;
  readonly firstSeenAt: Date;
  readonly lastActiveAt: Date;
  readonly isNew: boolean;
}

export interface Adoption {
  readonly activeCount: number;
  readonly activeChange: Delta | null;
  readonly newAdopterCount: number;
  readonly weeklyCount: number;
  readonly monthlyCount: number;
  readonly stickiness: number | null;
  readonly people: readonly PersonUse[];
}

export interface HumanActivity {
  readonly personId: string;
  readonly opened: number;
  readonly actions: number;
  readonly chats: number;
  readonly lastActiveAt: Date;
  readonly firstAt: Date;
}

export interface AdoptionCounts {
  readonly people: readonly HumanActivity[];
  readonly before: number;
  readonly weekly: number;
  readonly monthly: number;
}

export const adoptionFrom = (
  counts: AdoptionCounts,
  period: InsightsPeriod,
  firstSeen: ReadonlyMap<string, Date>,
): Adoption => {
  const people = counts.people.map((each): PersonUse => {
    const earliest = firstSeen.get(each.personId)?.getTime();
    const firstSeenAt = new Date(
      Math.min(each.firstAt.getTime(), ...(earliest ? [earliest] : [])),
    );

    return {
      personId: each.personId,
      tasksOpened: each.opened,
      actions: each.actions,
      chats: each.chats,
      firstSeenAt,
      lastActiveAt: each.lastActiveAt,
      isNew: within(period.current, firstSeenAt),
    };
  });

  return {
    activeCount: people.length,
    activeChange: deltaOf(people.length, counts.before, {
      better: 'up',
      unit: 'percent',
    }),
    newAdopterCount: people.filter((each) => each.isNew).length,
    weeklyCount: counts.weekly,
    monthlyCount: counts.monthly,
    stickiness: counts.monthly > 0 ? counts.weekly / counts.monthly : null,
    people,
  };
};
