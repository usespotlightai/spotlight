import type { ReflectionToTell } from '@replays/domain/services/reflection-notice';
import type { ReflectionOutcome } from '@replays/domain/value-objects/reflection-outcome';
import type {
  SearchCause,
  SearchCauseKind,
} from '@replays/domain/value-objects/search-cause.vo';

const MOST_POINTS = 20;

const MOST_POINT = 1_000;

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
    `${search} goes on, but found failures outside the config`,
  'no-config-cause': (search) =>
    `${search} stalled: nothing left the config can fix`,
  'no-failures': (search) =>
    `${search} stalled: its best config already passes every task it searches, so there was nothing to look into`,
  'did-not-run': (search) =>
    `${search} stalled, and looking into why could not run`,
  'out-of-budget': (search) =>
    `${search} ran out of budget: it found what the config could fix, but could not try it`,
};

const tasksCounted = (count: number): string =>
  `${count} ${count === 1 ? 'task' : 'tasks'}`;

const HAPPENINGS: Readonly<
  Record<ReflectionOutcome, (looked: number) => string>
> = {
  'went-on': (looked) =>
    `Two iterations in a row found nothing better, so its agent looked into the ${tasksCounted(looked)} the best config so far still fails. A change to the config could still fix some, so the search goes on.`,
  'no-config-cause': (looked) =>
    `Two iterations in a row found nothing better, so its agent looked into the ${tasksCounted(looked)} the best config so far still fails, and found none a change to the config could fix. The search ended, keeping what it did not spend.`,
  'no-failures': () =>
    'Two iterations in a row found nothing better, and its best config already passes every task it searches, so the search ended.',
  'did-not-run': () =>
    'Two iterations in a row found nothing better, so its agent set out to look into why, but its run failed before it recorded any cause. The search ended; its page links to that run.',
  'out-of-budget': (looked) =>
    `Two iterations in a row found nothing better, so its agent looked into the ${tasksCounted(looked)} the best config so far still fails. A change to the config could still fix some, but the search had no budget left to try one, so it ended.`,
};

const clipped = (text: string): string =>
  text.length > MOST_POINT ? `${text.slice(0, MOST_POINT - 1)}…` : text;

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
  points.length > MOST_POINTS
    ? [
        ...points.slice(0, MOST_POINTS - 1),
        `${points.length - MOST_POINTS + 1} more on the search’s page`,
      ]
    : points;

export const ReflectionNoticeWording = {
  of(
    told: ReflectionToTell,
    stationName: string | null,
    titles: ReadonlyMap<string, string | null>,
  ): NoticeWords {
    return {
      headline: HEADLINES[told.outcome](searchFor(stationName)),
      points: keptToMost([
        HAPPENINGS[told.outcome](told.looked),
        ...told.fixes.map(pointOf(titles)),
      ]),
    };
  },
};

export const UnreflectedStallWording = {
  of(stationName: string | null): NoticeWords {
    return {
      headline: `${searchFor(stationName)} stalled, with no budget left to look into why`,
      points: [
        'Two iterations in a row found nothing better, and the search had no budget left for its agent to look into why the remaining tasks fail, so it ended. Start a new search with more budget to find out.',
      ],
    };
  },
};
