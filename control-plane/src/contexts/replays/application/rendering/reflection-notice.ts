import type { ReflectionNotice } from '@replays/domain/services/reflection-notice';
import type { ReflectionOutcome } from '@replays/domain/value-objects/reflection-outcome';
import type {
  SearchCause,
  SearchCauseKind,
} from '@replays/domain/value-objects/search-cause.vo';

const MAX_POINTS = 20;

const MAX_POINT = 1_000;

export interface NoticeWords {
  readonly headline: string;
  readonly points: readonly string[];
}

const FIXES: Readonly<Record<Exclude<SearchCauseKind, 'config'>, string>> = {
  task: 'Take the task out of the replay set, or reword it',
  judge: 'Fix the judge’s rubric',
  check: 'Fix the station’s check',
  infra: 'Fix what the run needed around the work',
};

const HEADLINES: Readonly<
  Record<ReflectionOutcome, (search: string) => string>
> = {
  'went-on': (search) =>
    `${search} goes on after finding failures outside the config`,
  'no-config-cause': (search) =>
    `${search} ended with nothing the config can fix`,
  'no-failures': (search) => `${search} ended with every searched task passing`,
  'did-not-run': (search) => `${search} ended after its reflection failed`,
  'out-of-budget': (search) => `${search} ran out of budget`,
};

const tasksCounted = (count: number): string =>
  `${count} ${count === 1 ? 'task' : 'tasks'}`;

const HAPPENINGS: Readonly<
  Record<ReflectionOutcome, (looked: number) => string>
> = {
  'went-on': (looked) =>
    `Two iterations in a row found nothing better. A config change could still fix some of the ${tasksCounted(looked)} still failing.`,
  'no-config-cause': (looked) =>
    `No config change can fix the ${tasksCounted(looked)} still failing. The rest of the budget stays unspent.`,
  'no-failures': () =>
    'Two iterations in a row found nothing better. The best config already passes every searched task.',
  'did-not-run': () =>
    'The reflection run failed before recording any cause. The search page links to that run.',
  'out-of-budget': (looked) =>
    `A config change could fix some of the ${tasksCounted(looked)} still failing. No budget was left to try one.`,
};

const clipped = (text: string): string =>
  text.length > MAX_POINT ? `${text.slice(0, MAX_POINT - 1)}…` : text;

const UNTITLED = 'one of the searched tasks';

const searchFor = (stationName: string | null): string =>
  `The search for ${stationName ? `a better ${stationName} config` : 'a better station config'}`;

const pointOf =
  (titles: ReadonlyMap<string, string | null>) =>
  (cause: SearchCause): string => {
    const title = titles.get(cause.originalRunId.value)?.trim();

    return clipped(
      `${FIXES[cause.cause as Exclude<SearchCauseKind, 'config'>]}, for ${title ? `“${title}”` : UNTITLED}: ${cause.suggestion ?? cause.evidence}`,
    );
  };

const keptToMost = (points: readonly string[]): readonly string[] =>
  points.length > MAX_POINTS
    ? [
        ...points.slice(0, MAX_POINTS - 1),
        `The search page shows ${points.length - MAX_POINTS + 1} more.`,
      ]
    : points;

export const ReflectionNoticeWording = {
  of(
    notice: ReflectionNotice,
    stationName: string | null,
    titles: ReadonlyMap<string, string | null>,
  ): NoticeWords {
    return {
      headline: HEADLINES[notice.outcome](searchFor(stationName)),
      points: keptToMost([
        HAPPENINGS[notice.outcome](notice.looked),
        ...notice.fixes.map(pointOf(titles)),
      ]),
    };
  },
};

export const UnreflectedStallWording = {
  of(stationName: string | null): NoticeWords {
    return {
      headline: `${searchFor(stationName)} ended with no budget left to reflect`,
      points: [
        'Two iterations in a row found nothing better. Please start a new search with more budget to find out why.',
      ],
    };
  },
};
