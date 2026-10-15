import type { TeamHistory } from '@outcomes/domain/services/team-history';
import {
  type Change,
  changeOf,
} from '@outcomes/domain/value-objects/change.vo';
import {
  type InsightsPeriod,
  type Window,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';

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
  readonly acts: number;
  readonly chats: number;
  readonly firstSeenAt: Date;
  readonly lastActiveAt: Date;
  readonly isNew: boolean;
}

export interface Adoption {
  readonly activeCount: number;
  readonly activeChange: Change | null;
  readonly newAdopterCount: number;
  readonly weeklyCount: number;
  readonly monthlyCount: number;
  readonly stickiness: number | null;
  readonly people: readonly PersonUse[];
}

export const activitiesOf = (history: TeamHistory): readonly Activity[] => [
  ...history.touches.flatMap((touches) => [
    ...(touches.opening?.by
      ? [
          {
            personId: touches.opening.by.value,
            kind: 'opened' as const,
            at: touches.opening.at,
            taskId: touches.taskId.value,
            chatId: null,
          },
        ]
      : []),
    ...touches.acts.map((act) => ({
      personId: act.by.value,
      kind: 'acted' as const,
      at: act.at,
      taskId: touches.taskId.value,
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

export interface PersonActivity {
  readonly personId: string;
  readonly opened: number;
  readonly acts: number;
  readonly chats: number;
  readonly lastActiveAt: Date;
  readonly firstAt: Date;
}

export interface AdoptionCounts {
  readonly people: readonly PersonActivity[];
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
        acts: counted('acted'),
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
      acts: each.acts,
      chats: each.chats,
      firstSeenAt,
      lastActiveAt: each.lastActiveAt,
      isNew: within(period.current, firstSeenAt),
    };
  });

  return {
    activeCount: people.length,
    activeChange: changeOf(people.length, counts.before, {
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
