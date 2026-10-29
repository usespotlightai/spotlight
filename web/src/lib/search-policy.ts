import type { StationSearchResponseDto } from '@/lib/api';
import { costTick } from '@/lib/chart';
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

export const searchPolicyDetail = (policy: SearchPolicy): string =>
  policy.enabled
    ? `Up to ${costTick(policy.ceiling, policy.currency)} a search · every ${durationWords(policy.period)}`
    : 'No automatic searches';

export const searchPolicyNote = (policy: SearchPolicy): TooltipNote => ({
  body: 'Spotlight searches for a better config of this station and opens a pull request for it.',
  rows: [
    ['Line ceiling a month', costTick(policy.monthlyCeiling, policy.currency)],
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
