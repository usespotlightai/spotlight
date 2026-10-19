import type { ReactNode } from 'react';
import { RegressionCount } from '@/components/features/searches/search/RegressionCount';
import { ResultGain } from '@/components/features/searches/search/ResultGain';
import { ResultRate } from '@/components/features/searches/search/ResultRate';
import { LIVE_CONFIG_LABEL } from '@/lib/replay-words';
import {
  formatCostPerRun,
  formatHeldOut,
  type SearchCandidate,
} from '@/lib/search';
import {
  GAIN_TITLE,
  NO_VALUE,
  RESULTS_TITLE,
  THIS_CONFIG,
} from '@/lib/search-words';
import { cn } from '@/lib/utils';

type ResultRow = {
  label: string;
  of: (candidate: SearchCandidate) => ReactNode;
  gain?: (candidate: SearchCandidate) => ReactNode;
};

const rowsOf = (currency: string, withRegressions: boolean): ResultRow[] => [
  {
    label: 'Held out',
    of: (candidate) => (
      <ResultRate
        rate={candidate.heldOutScore}
        interval={candidate.heldOutInterval}
        unscored={formatHeldOut(candidate)}
      />
    ),
    gain: (candidate) => <ResultGain gain={candidate.heldOutGain} />,
  },
  {
    label: 'Searched',
    of: (candidate) => (
      <ResultRate
        rate={candidate.searchScore}
        interval={candidate.searchInterval}
        unscored={NO_VALUE}
      />
    ),
    gain: (candidate) => <ResultGain gain={candidate.searchedGain} />,
  },
  {
    label: 'Cost per run',
    of: (candidate) => (
      <span className="tabular-nums">
        {formatCostPerRun(candidate.costPerRun, currency)}
      </span>
    ),
  },
  ...(withRegressions
    ? [
        {
          label: 'Regressions',
          of: (candidate: SearchCandidate) =>
            candidate.isSeed ? (
              NO_VALUE
            ) : (
              <RegressionCount regressions={candidate.regressions} />
            ),
        },
      ]
    : []),
];

const HEADER = 'pb-1 text-left font-normal text-muted-foreground text-xs';
const CELL = 'py-1 pr-4 align-baseline last:pr-0';

type CandidateResultsProps = {
  candidate: SearchCandidate;
  live: SearchCandidate;
  currency: string;
};

export function CandidateResults({
  candidate,
  live,
  currency,
}: CandidateResultsProps) {
  const compared = !candidate.isSeed;
  const rows = rowsOf(currency, compared);

  return (
    <table
      aria-label={RESULTS_TITLE}
      className="w-full text-foreground text-sm"
    >
      <thead>
        <tr>
          <th scope="col" className={HEADER}>
            <span className="sr-only">Measure</span>
          </th>
          <th scope="col" className={HEADER}>
            {compared ? THIS_CONFIG : LIVE_CONFIG_LABEL}
          </th>
          {compared && (
            <>
              <th scope="col" className={HEADER}>
                {LIVE_CONFIG_LABEL}
              </th>
              <th scope="col" className={HEADER}>
                {GAIN_TITLE}
              </th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th
              scope="row"
              className={cn(
                CELL,
                'whitespace-nowrap text-left font-normal text-muted-foreground',
              )}
            >
              {row.label}
            </th>
            <td className={CELL}>{row.of(candidate)}</td>
            {compared && (
              <>
                <td className={cn(CELL, 'text-muted-foreground')}>
                  {row.of(live)}
                </td>
                <td className={CELL}>{row.gain?.(candidate)}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
