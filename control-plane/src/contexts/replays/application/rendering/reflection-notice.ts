import type { ReflectionNotice } from '@replays/domain/services/reflection-notice';
import type {
  FailureCause,
  FailureCauseKind,
} from '@replays/domain/value-objects/failure-cause.vo';
import type { ReflectionResult } from '@replays/domain/value-objects/reflection-result';

const MAX_POINTS = 20;

const MAX_POINT = 1_000;

const MAX_TITLE = 120;

export interface NoticeWords {
  readonly headline: string;
  readonly points: readonly string[];
}

type OutsideConfig = Exclude<FailureCauseKind, 'config'>;

const CAUSES: Readonly<Record<OutsideConfig, string>> = {
  task: 'the task itself',
  judge: 'the judge',
  check: 'the check',
  infra: 'what the run needed around the work',
};

const FIXES: Readonly<Record<OutsideConfig, string>> = {
  task: 'Spotlight takes the task out of the replay set.',
  judge: 'Please fix the rubric of the judge.',
  check: 'Please fix the check of the station.',
  infra: 'Please fix the setup that the run needs.',
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
  'did-not-run': () => 'The reflection run failed before it recorded a cause.',
  'ceiling-reached': (looked) =>
    `A config change could fix some of the ${tasksCounted(looked)} still failing. No budget was left to try one.`,
};

const clipped = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, Math.max(max - 1, 0))}…` : text;

const UNTITLED = 'Untitled task';

const pointOf =
  (titles: ReadonlyMap<string, string | null>) =>
  (cause: FailureCause): string => {
    const title = titles.get(cause.originalRunId.value)?.trim();
    const kind = cause.cause as OutsideConfig;
    const lead = `${title ? `“${clipped(title, MAX_TITLE)}”` : UNTITLED}: the cause is ${CAUSES[kind]}.`;
    const fix = FIXES[kind];
    const room = MAX_POINT - lead.length - fix.length - 2;

    return `${lead} ${clipped(cause.suggestion ?? cause.evidence, room)} ${fix}`;
  };

const cappedAtMax = (points: readonly string[]): readonly string[] =>
  points.length > MAX_POINTS
    ? [
        ...points.slice(0, MAX_POINTS - 1),
        `${points.length - MAX_POINTS + 1} more causes are not shown.`,
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

  fixesOf(
    notice: ReflectionNotice,
    titles: ReadonlyMap<string, string | null>,
  ): readonly string[] {
    return cappedAtMax(notice.fixes.map(pointOf(titles)));
  },
};

export const UnreflectedStallWording = {
  points: [
    'Two iterations in a row found nothing better. No budget was left to find out why.',
  ],
} as const;
