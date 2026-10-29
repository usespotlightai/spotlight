import type { NoticeWords } from '@replays/application/rendering/reflection-notice';
import {
  type AdvisedSkipReason,
  SKIP_ADVICE,
} from '@replays/application/rendering/skip-advice';
import type { ReplayStopReason } from '@replays/domain/value-objects/replay-state';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import type { SearchPickDecline } from '@replays/domain/value-objects/search-pick';
import type { SearchCutShort } from '@replays/domain/value-objects/search-stop-reason';

const percent = (value: number): number => Math.round(value * 100);

const pointsOf = (gain: number): string =>
  `${gain >= 0 ? '+' : '−'}${Math.abs(percent(gain))} points`;

const stationOf = (name: string | null): string =>
  name ? `the ${name} station` : 'a station';

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

const STOPS: Readonly<Record<SearchCutShort, string>> = {
  'turned-off': 'A person turned off search for the station.',
  'station-gone': 'The station is no longer on the line.',
  'seed-failed': 'The replay of the live config failed.',
};

export interface RequestedResult {
  readonly objective: SearchObjective;
  readonly candidateName: string;
  readonly replayed: ReplayStopReason | 'unfinished' | null;
  readonly heldOutGain: number | null;
  readonly searchedGain: number | null;
  readonly costPerRun: number | null;
  readonly liveCostPerRun: number | null;
  readonly currency: string;
}

const heldOutResultOf = (result: RequestedResult, gain: number): string =>
  result.objective === 'cost' &&
  result.costPerRun !== null &&
  result.liveCostPerRun !== null
    ? `Candidate ${result.candidateName}, cost per run: ${result.costPerRun.toFixed(2)} ${result.currency}, compared with ${result.liveCostPerRun.toFixed(2)} ${result.currency} for the live config`
    : `Candidate ${result.candidateName}, held-out gain: ${pointsOf(gain)}`;

const requestedResultOf = (result: RequestedResult): string => {
  const name = result.candidateName;

  switch (result.replayed) {
    case null:
      return `Spotlight did not replay ${name}: the search ended first.`;
    case 'unfinished':
      return `Spotlight did not finish the replay of ${name}: the search ended first.`;
    case 'ceiling-reached':
      return `The replay of ${name} stopped at the search ceiling.`;
    case 'stopped':
    case 'deleted':
      return `The replay of ${name} failed.`;
    case 'finished':
      return result.heldOutGain !== null
        ? heldOutResultOf(result, result.heldOutGain)
        : `Candidate ${name} did not beat the live config on the searched tasks. Searched gain: ${result.searchedGain === null ? 'not measured' : pointsOf(result.searchedGain)}`;
  }
};

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
  ): NoticeWords {
    return {
      headline: `Spotlight did not open a config pull request for ${stationOf(stationName)}`,
      points: [DECLINES[reason], ...results.map(requestedResultOf)],
    };
  },

  pickedOther(
    stationName: string | null,
    pickedName: string,
    results: readonly RequestedResult[],
  ): NoticeWords {
    return {
      headline: `Spotlight opened a config pull request for another candidate of ${stationOf(stationName)}`,
      points: [
        `Candidate ${pickedName} became the config pull request.`,
        ...results.map(requestedResultOf),
      ],
    };
  },

  stopped(
    stationName: string | null,
    reason: SearchCutShort,
    results: readonly RequestedResult[],
  ): NoticeWords {
    return {
      headline: `The search of ${stationOf(stationName)} stopped before a result`,
      points: [STOPS[reason], ...results.map(requestedResultOf)],
    };
  },

  stalled(stationName: string | null, fixes: readonly string[]): NoticeWords {
    return {
      headline: `The search of ${stationOf(stationName)} stalled on causes outside the config`,
      points: fixes,
    };
  },

  skipped(stationName: string | null, reason: AdvisedSkipReason): NoticeWords {
    return {
      headline: `Spotlight cannot search ${stationOf(stationName)}`,
      points: SKIP_ADVICE[reason],
    };
  },
};
