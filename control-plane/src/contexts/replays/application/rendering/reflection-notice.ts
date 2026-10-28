import type { ReflectionNotice } from '@replays/domain/services/reflection-notice';
import type {
  FailureCause,
  FailureCauseKind,
} from '@replays/domain/value-objects/failure-cause.vo';
import type { ReflectionResult } from '@replays/domain/value-objects/reflection-result';

const MAX_POINTS = 20;

const MAX_POINT = 1_000;

export interface NoticeWords {
  readonly headline: string;
  readonly points: readonly string[];
}

const FIXES: Readonly<Record<Exclude<FailureCauseKind, 'config'>, string>> = {
  task: 'Take the task out of the replay set, or reword it',
  judge: 'Fix the judge’s rubric',
  check: 'Fix the station’s check',
  infra: 'Fix what the run needed around the work',
};

const tasksCounted = (count: number): string =>
  `${count} ${count === 1 ? 'task' : 'tasks'}`;

const HAPPENINGS: Readonly<
  Record<ReflectionResult, (looked: number) => string>
> = {
  continued: (looked) =>
    `Two iterations in a row found nothing better. A config change could still fix some of the ${tasksCounted(looked)} still failing.`,
  'no-config-cause': (looked) =>
    `No config change can fix the ${tasksCounted(looked)} still failing. The rest of the budget stays unspent.`,
  'no-failures': () =>
    'Two iterations in a row found nothing better. The best config already passes every searched task.',
  'did-not-run': () =>
    'The reflection run failed before recording any cause. The search page links to that run.',
  'ceiling-reached': (looked) =>
    `A config change could fix some of the ${tasksCounted(looked)} still failing. No budget was left to try one.`,
};

const clipped = (text: string): string =>
  text.length > MAX_POINT ? `${text.slice(0, MAX_POINT - 1)}…` : text;

const UNTITLED = 'one of the searched tasks';

const pointOf =
  (titles: ReadonlyMap<string, string | null>) =>
  (cause: FailureCause): string => {
    const title = titles.get(cause.originalRunId.value)?.trim();

    return clipped(
      `${FIXES[cause.cause as Exclude<FailureCauseKind, 'config'>]}, for ${title ? `“${title}”` : UNTITLED}: ${cause.suggestion ?? cause.evidence}`,
    );
  };

const cappedAtMax = (points: readonly string[]): readonly string[] =>
  points.length > MAX_POINTS
    ? [
        ...points.slice(0, MAX_POINTS - 1),
        `The search page shows ${points.length - MAX_POINTS + 1} more.`,
      ]
    : points;

export const ReflectionNoticeWording = {
  pointsOf(
    notice: ReflectionNotice,
    titles: ReadonlyMap<string, string | null>,
  ): readonly string[] {
    return cappedAtMax([
      HAPPENINGS[notice.result](notice.looked),
      ...notice.fixes.map(pointOf(titles)),
    ]);
  },
};

export const UnreflectedStallWording = {
  points: [
    'Two iterations in a row found nothing better. No budget was left to find out why.',
  ],
} as const;
