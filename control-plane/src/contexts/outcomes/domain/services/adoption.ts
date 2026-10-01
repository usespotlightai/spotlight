import type { TeamHistory } from '@outcomes/domain/services/team-history';
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
  readonly active: readonly string[];
  readonly activeBefore: readonly string[];
  readonly newAdopters: readonly string[];
  readonly weekly: readonly string[];
  readonly monthly: readonly string[];
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

const usesOf = (
  activities: readonly Activity[],
  personId: string,
  firstSeenAt: Date,
  window: Window,
): PersonUse => {
  const own = activities.filter(
    (each) => each.personId === personId && within(window, each.at),
  );
  const counted = (kind: ActivityKind) =>
    own.filter((each) => each.kind === kind).length;

  return {
    personId,
    tasksOpened: counted('opened'),
    acts: counted('acted'),
    chats: counted('chatted'),
    firstSeenAt,
    lastActiveAt: new Date(Math.max(...own.map((each) => each.at.getTime()))),
    isNew: within(window, firstSeenAt),
  };
};

export const adoptionOf = (
  history: TeamHistory,
  period: InsightsPeriod,
  firstSeen: ReadonlyMap<string, Date>,
): Adoption => {
  const activities = activitiesOf(history);
  const active = peopleActiveIn(activities, period.current);
  const weekly = peopleActiveIn(activities, period.lastWeek);
  const monthly = peopleActiveIn(activities, period.lastMonth);
  const firstOf = (personId: string): Date => {
    const seen = activities
      .filter((each) => each.personId === personId)
      .map((each) => each.at.getTime());
    const earliest = firstSeen.get(personId)?.getTime();

    return new Date(Math.min(...seen, ...(earliest ? [earliest] : [])));
  };
  const people = active.map((personId) =>
    usesOf(activities, personId, firstOf(personId), period.current),
  );

  return {
    active,
    activeBefore: peopleActiveIn(activities, period.previous),
    newAdopters: people
      .filter((each) => each.isNew)
      .map((each) => each.personId),
    weekly,
    monthly,
    stickiness: monthly.length > 0 ? weekly.length / monthly.length : null,
    people,
  };
};
