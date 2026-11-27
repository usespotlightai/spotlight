import type { NoticeWords } from '@replays/application/rendering/reflection-notice';
import { SKIP_ADVICE } from '@replays/application/rendering/skip-advice';
import { CHECK_SKIPS } from '@replays/application/rendering/task-rows';
import type {
  ReplayChecks,
  SkippedChecks,
} from '@replays/domain/services/replay-checks';
import type { ReplayEndState } from '@replays/domain/value-objects/replay-state';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import type { SearchPickDecline } from '@replays/domain/value-objects/search-pick';
import type { LastingSkipReason } from '@replays/domain/value-objects/search-skip-reason';
import type {
  SearchCutShort,
  SearchStopReason,
} from '@replays/domain/value-objects/search-stop-reason';
import { nonEmpty } from '@shared-kernel/domain/non-empty';

const percent = (value: number): number => Math.round(value * 100);

const pointsOf = (gain: number): string =>
  `${gain >= 0 ? '+' : '−'}${Math.abs(percent(gain))} points`;

const stationOf = (name: string | null): string =>
  nonEmpty(name) ? `the ${name} station` : 'a station';

export interface PickedResult {
  readonly objective: SearchObjective;
  readonly stationName: string | null;
  readonly candidateName: string;
  readonly changes: readonly string[];
  readonly heldOutGain: number | null;
  readonly costPerRun: number | null;
  readonly liveCostPerRun: number | null;
  readonly currency: string;
}

const changeOf = (picked: PickedResult): string =>
  picked.changes.length > 0
    ? `Candidate ${picked.candidateName} changes ${picked.changes.join(', ')}.`
    : `Candidate ${picked.candidateName} changes the station config.`;

const gainOf = (picked: PickedResult): string =>
  picked.heldOutGain === null
    ? 'Held-out gain: not measured'
    : `Held-out gain: ${pointsOf(picked.heldOutGain)}`;

const costOf = (picked: PickedResult): string =>
  picked.costPerRun === null || picked.liveCostPerRun === null
    ? 'Cost per run: not measured'
    : `Cost per run: ${picked.costPerRun.toFixed(2)} ${picked.currency}, against ${picked.liveCostPerRun.toFixed(2)} ${picked.currency} for the live config`;

const RESULT_OF: Readonly<
  Record<SearchObjective, (picked: PickedResult) => string>
> = {
  success: gainOf,
  cost: costOf,
};

const DECLINES: Readonly<Record<SearchPickDecline, string>> = {
  'no-candidate':
    'No candidate did better than the live config on the searched tasks.',
  'no-held-out-gain':
    'No candidate did better than the live config on the held-out tasks.',
  'not-cheaper': 'No candidate cost less per run than the live config.',
  'over-regression-limit':
    'The best candidate failed more tasks than the regression limit of the line allows.',
  'likely-overfit':
    'The best candidate did better on the searched tasks only, not on the held-out tasks.',
  'station-gone': 'The station is no longer on the line.',
  'pull-request-open': 'A config pull request for the station is open.',
  'rejected-before':
    'A person closed a config pull request with the same config before.',
};

export const STOPS: Readonly<Record<SearchCutShort, string>> = {
  'turned-off': 'A person turned off search for the station.',
  'station-gone': 'The station is no longer on the line.',
  'seed-failed': 'The replay of the live config failed.',
};

export interface TaskScore {
  readonly successRate: number | null;
  readonly tasks: number;
  readonly tasksScored: number;
}

export interface SpentShare {
  readonly spent: number;
  readonly share: number;
}

export interface RequestedResult {
  readonly objective: SearchObjective;
  readonly candidateName: string;
  readonly replayed: ReplayEndState | 'unfinished' | null;
  readonly heldOutGain: number | null;
  readonly searchedGain: number | null;
  readonly searched: TaskScore | null;
  readonly spent: SpentShare | null;
  readonly costPerRun: number | null;
  readonly liveCostPerRun: number | null;
  readonly currency: string;
}

export interface SearchSummary {
  readonly currency: string;
  readonly ceiling: number;
  readonly spent: number;
  readonly stopReason: SearchStopReason | null;
  readonly candidateFinished: boolean;
  readonly live: {
    readonly replayed: ReplayEndState | null;
    readonly calibrates: boolean;
    readonly tasks: number;
    readonly repeats: number;
    readonly searched: TaskScore | null;
    readonly spent: SpentShare | null;
  };
  readonly checks: ReplayChecks;
}

const counted = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

const successOn = (score: TaskScore): string => {
  const tasks = counted(score.tasks, 'searched task', 'searched tasks');

  if (score.successRate === null || score.tasksScored === 0) {
    return `none of the ${tasks} scored`;
  }

  const rate = `${percent(score.successRate)}% success`;

  return score.tasksScored < score.tasks
    ? `${rate} on ${score.tasksScored} of ${tasks}`
    : `${rate} on ${tasks}`;
};

const moneyOf = (amount: number, currency: string): string =>
  `${amount.toFixed(2)} ${currency}`;

const ENDED_FIRST: Readonly<Partial<Record<SearchStopReason, string>>> = {
  'ceiling-reached': 'the search reached its ceiling first',
  'iterations-spent': 'the search used all its iterations first',
  stalled: 'the search stalled first',
};

const endedFirst = (summary: SearchSummary): string =>
  (summary.stopReason && ENDED_FIRST[summary.stopReason]) ??
  'the search ended first';

const heldOutResultOf = (result: RequestedResult, gain: number): string =>
  result.objective === 'cost' &&
  result.costPerRun !== null &&
  result.liveCostPerRun !== null
    ? `Candidate ${result.candidateName}, cost per run: ${result.costPerRun.toFixed(2)} ${result.currency}, compared with ${result.liveCostPerRun.toFixed(2)} ${result.currency} for the live config`
    : `Candidate ${result.candidateName}, held-out gain: ${pointsOf(gain)}`;

const soFar = (score: TaskScore | null): string =>
  score && score.tasksScored > 0 ? ` So far: ${successOn(score)}.` : '';

const shareOf = (result: RequestedResult): string =>
  result.spent
    ? ` It spent ${moneyOf(result.spent.spent, result.currency)}, and its share of the ceiling was ${moneyOf(result.spent.share, result.currency)}.`
    : '';

const notBetter = (name: string, score: TaskScore | null): string =>
  score
    ? `Candidate ${name}: ${successOn(score)}. It did not beat the live config there.`
    : `Candidate ${name} did not beat the live config on the searched tasks.`;

const requestedResultOf =
  (summary: SearchSummary) =>
  (result: RequestedResult): string => {
    const name = result.candidateName;

    switch (result.replayed) {
      case null:
        return `Spotlight did not replay ${name}: ${endedFirst(summary)}.`;
      case 'unfinished':
        return `Spotlight did not finish the replay of ${name}: ${endedFirst(summary)}.${soFar(result.searched)}`;
      case 'ceiling-reached':
        return `The replay of ${name} stopped at the search ceiling${result.searched ? `: ${successOn(result.searched)}` : ''}.${shareOf(result)}`;
      case 'stopped':
      case 'deleted':
        return `The replay of ${name} failed.`;
      case 'finished':
        return result.heldOutGain !== null
          ? heldOutResultOf(result, result.heldOutGain)
          : `${notBetter(name, result.searched)} Searched gain: ${result.searchedGain === null ? 'not measured' : pointsOf(result.searchedGain)}`;
    }
  };

export const declineOf = (
  reason: SearchPickDecline,
  summary: Pick<SearchSummary, 'candidateFinished'>,
): string =>
  reason === 'no-candidate' && !summary.candidateFinished
    ? 'No candidate finished its replay of the searched tasks.'
    : DECLINES[reason];

const liveOf = (summary: SearchSummary): readonly string[] =>
  summary.live.searched
    ? [`Live config: ${successOn(summary.live.searched)}.`]
    : [];

const skipsOf = (skipped: readonly SkippedChecks[]): string =>
  skipped.length === 1
    ? CHECK_SKIPS[skipped[0].skip]
    : skipped
        .map((each) => `${CHECK_SKIPS[each.skip]} in ${each.runs}`)
        .join(', ');

const checksOf = (summary: SearchSummary): readonly string[] => {
  const { ran, skipped } = summary.checks;
  const unchecked = skipped.reduce((sum, each) => sum + each.runs, 0);

  if (unchecked > 0) {
    return [
      `Checks did not run in ${unchecked} of ${counted(ran + unchecked, 'replayed run', 'replayed runs')}: ${skipsOf(skipped)}. A run without checks counts only when the judge fails it.`,
    ];
  }

  return ran > 0
    ? [`Checks ran in ${counted(ran, 'replayed run', 'replayed runs')}.`]
    : [];
};

const liveReplayOf = (summary: SearchSummary): string => {
  const { live } = summary;
  const tasks = counted(live.tasks, 'task', 'tasks');
  const replayed =
    live.repeats > 1 ? `${tasks} ${live.repeats} times each` : tasks;
  const stopped = live.replayed === 'ceiling-reached';

  if (live.calibrates) {
    return `Calibration of the live config replayed ${replayed}${stopped ? ' and stopped at the search ceiling' : ''}.`;
  }

  return stopped
    ? 'The replay of the live config stopped at the search ceiling.'
    : `The live config replayed ${replayed}.`;
};

const liveSpentOf = (summary: SearchSummary): string => {
  const { live, currency } = summary;
  const spent = live.spent
    ? ` It spent ${moneyOf(live.spent.spent, currency)}, and its share of the ${moneyOf(summary.ceiling, currency)} search ceiling was ${moneyOf(live.spent.share, currency)}.`
    : '';

  return `${liveReplayOf(summary)}${spent}`;
};

const ceilingOf = (
  summary: SearchSummary,
  results: readonly RequestedResult[],
): readonly string[] => {
  const liveStopped = summary.live.replayed === 'ceiling-reached';
  const searchStopped =
    !liveStopped && summary.stopReason === 'ceiling-reached';

  if (
    !liveStopped &&
    !searchStopped &&
    !results.some((each) => each.replayed === 'ceiling-reached')
  ) {
    return [];
  }

  return [
    liveSpentOf(summary),
    ...(searchStopped
      ? [
          `The search spent ${moneyOf(summary.spent, summary.currency)} of its ${moneyOf(summary.ceiling, summary.currency)} ceiling, and another iteration did not fit.`,
        ]
      : []),
  ];
};

const resultsOf = (
  summary: SearchSummary,
  results: readonly RequestedResult[],
): readonly string[] => [
  ...liveOf(summary),
  ...results.map(requestedResultOf(summary)),
  ...checksOf(summary),
  ...ceilingOf(summary, results),
];

export const SearchResultWording = {
  opened(picked: PickedResult): NoticeWords {
    return {
      headline: `Spotlight opened a config pull request for ${stationOf(picked.stationName)}`,
      points: [changeOf(picked), RESULT_OF[picked.objective](picked)],
    };
  },

  failed(picked: PickedResult, reason: string): NoticeWords {
    return {
      headline: `Sorry, the config pull request for ${stationOf(picked.stationName)} could not be opened`,
      points: [changeOf(picked), `Reason: ${reason}`],
    };
  },

  declined(
    stationName: string | null,
    reason: SearchPickDecline,
    results: readonly RequestedResult[],
    summary: SearchSummary,
  ): NoticeWords {
    return {
      headline: `Spotlight did not open a config pull request for ${stationOf(stationName)}`,
      points: [declineOf(reason, summary), ...resultsOf(summary, results)],
    };
  },

  pickedOther(
    stationName: string | null,
    pickedName: string,
    results: readonly RequestedResult[],
    summary: SearchSummary,
  ): NoticeWords {
    return {
      headline: `Spotlight opened a config pull request for another candidate of ${stationOf(stationName)}`,
      points: [
        `Candidate ${pickedName} became the config pull request.`,
        ...resultsOf(summary, results),
      ],
    };
  },

  stopped(
    stationName: string | null,
    reason: SearchCutShort,
    results: readonly RequestedResult[],
    summary: SearchSummary,
  ): NoticeWords {
    return {
      headline: `The search of ${stationOf(stationName)} stopped before a result`,
      points: [STOPS[reason], ...resultsOf(summary, results)],
    };
  },

  stalled(stationName: string | null, fixes: readonly string[]): NoticeWords {
    return {
      headline: `The search of ${stationOf(stationName)} stalled on causes outside the config`,
      points: fixes,
    };
  },

  skipped(stationName: string | null, reason: LastingSkipReason): NoticeWords {
    return {
      headline: `Spotlight cannot search ${stationOf(stationName)}`,
      points: SKIP_ADVICE[reason],
    };
  },
};
