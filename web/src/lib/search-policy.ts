import type { StationSearchResponseDto } from '@/lib/api';
import type { TooltipNote } from '@/lib/tooltip-note';

type SearchObjective = NonNullable<StationSearchResponseDto['objective']>;

const OBJECTIVES: Record<SearchObjective, string> = {
  success: 'More success',
  cost: 'The same success for less',
};

export type SearchPolicy = StationSearchResponseDto;

const UNITS: Readonly<Record<string, readonly [string, string]>> = {
  m: ['minute', 'minutes'],
  h: ['hour', 'hours'],
  d: ['day', 'days'],
};

const SPOTLIGHT_PICKS = 'Spotlight picks';

export const durationWords = (written: string): string => {
  const [, amount, unit] = /^(\d+)([mhd])$/.exec(written) ?? [];
  const words = unit ? UNITS[unit] : undefined;

  if (!amount || !words) {
    return written;
  }

  return `${amount} ${Number(amount) === 1 ? words[0] : words[1]}`;
};

const agentOf = (agent: SearchPolicy['agent']): string =>
  agent
    ? [agent.harness, agent.model, agent.effort].filter(Boolean).join(', ')
    : SPOTLIGHT_PICKS;

export const SEARCH_WINDOW_DAYS = 30;

const DAYS_PER_UNIT: Readonly<Record<string, number>> = {
  m: 1 / 1440,
  h: 1 / 24,
  d: 1,
};

export const periodDays = (written: string): number | null => {
  const [, amount, unit] = /^(\d+)([mhd])$/.exec(written) ?? [];
  const days = unit ? DAYS_PER_UNIT[unit] : undefined;

  return amount && days && Number(amount) > 0 ? Number(amount) * days : null;
};

export type MonthSearch = {
  readonly day: number;
  readonly fits: boolean;
};

export type SearchMonth = {
  readonly searches: readonly MonthSearch[];
  readonly fitting: number;
  readonly spent: number;
  readonly asked: number;
};

export const searchMonth = (policy: SearchPolicy): SearchMonth | null => {
  const every = periodDays(policy.period);

  if (every === null) {
    return null;
  }

  const searches: MonthSearch[] = [];
  let spent = 0;
  for (let day = 0; day < SEARCH_WINDOW_DAYS; day += every) {
    const fits = spent + policy.ceiling <= policy.monthlyCeiling;
    if (fits) {
      spent += policy.ceiling;
    }
    searches.push({ day, fits });
  }

  return {
    searches,
    fitting: searches.filter((search) => search.fits).length,
    spent,
    asked: searches.length * policy.ceiling,
  };
};

export const searchPolicyNote = (policy: SearchPolicy): TooltipNote => ({
  body: 'Spotlight searches for a better config of this station and opens a pull request for it. The chart shows the most a month can cost. A search often spends less, an alert can start more, and other stations on the line spend from the same monthly ceiling.',
  rows: [
    [
      'After an alert',
      policy.onAlert ? 'Starts a search' : "Doesn't start a search",
    ],
    ['Cooldown', durationWords(policy.cooldown)],
    ['Agent', agentOf(policy.agent)],
    ['Iterations', policy.iterations?.toString() ?? SPOTLIGHT_PICKS],
    ['Repeats', policy.repeats?.toString() ?? SPOTLIGHT_PICKS],
    [
      'Objective',
      policy.objective ? OBJECTIVES[policy.objective] : 'Station health picks',
    ],
  ],
});
