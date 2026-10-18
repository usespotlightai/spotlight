import type { TeamHistory } from '@insights/domain/services/team-history';
import { type Delta, deltaOf } from '@insights/domain/value-objects/delta.vo';
import {
  type InsightsPeriod,
  type Window,
  within,
} from '@insights/domain/value-objects/insights-period.vo';

type ActivityKind = 'opened' | 'acted' | 'chatted';

export interface Activity {
  readonly personId: string;
  readonly kind: ActivityKind;
  readonly at: Date;
  readonly taskId: string | null;
  readonly chatId: string | null;
}

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

export const activitiesOf = (history: TeamHistory): readonly Activity[] => [
  ...history.taskHumanActions.flatMap((humanActions) => [
    ...(humanActions.opening?.by
      ? [
          {
            personId: humanActions.opening.by.value,
            kind: 'opened' as const,
            at: humanActions.opening.at,
            taskId: humanActions.taskId.value,
            chatId: null,
          },
        ]
      : []),
    ...humanActions.actions.map((action) => ({
      personId: action.by.value,
      kind: 'acted' as const,
      at: action.at,
      taskId: humanActions.taskId.value,
      chatId: null,
    })),
  ]),
  ...history.chats.map((chat) => ({
    personId: chat.startedBy.value,
    kind: 'chatted' as const,
    at: chat.startedAt,
    taskId: null,
    chatId: chat.chatId,
  })),
];

export const peopleActiveIn = (
  activities: readonly Activity[],
  window: Window,
): readonly string[] =>
  [
    ...new Set(
      activities
        .filter((each) => within(window, each.at))
        .map((each) => each.personId),
    ),
  ].sort();

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

export const adoptionCountsOf = (
  history: TeamHistory,
  period: InsightsPeriod,
): AdoptionCounts => {
  const activities = activitiesOf(history);

  return {
    people: peopleActiveIn(activities, period.current).map((personId) => {
      const all = activities.filter((each) => each.personId === personId);
      const own = all.filter((each) => within(period.current, each.at));
      const counted = (kind: ActivityKind) =>
        own.filter((each) => each.kind === kind).length;

      return {
        personId,
        opened: counted('opened'),
        actions: counted('acted'),
        chats: counted('chatted'),
        lastActiveAt: new Date(
          Math.max(...own.map((each) => each.at.getTime())),
        ),
        firstAt: new Date(Math.min(...all.map((each) => each.at.getTime()))),
      };
    }),
    before: peopleActiveIn(activities, period.previous).length,
    weekly: peopleActiveIn(activities, period.lastWeek).length,
    monthly: peopleActiveIn(activities, period.lastMonth).length,
  };
};

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
