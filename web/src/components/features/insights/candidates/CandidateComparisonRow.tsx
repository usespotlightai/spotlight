import { ExternalLink } from 'lucide-react';
import { AdoptedPill } from '@/components/features/insights/candidates/AdoptedPill';
import { ComparisonCell } from '@/components/features/insights/candidates/ComparisonCell';
import { GainSaid } from '@/components/features/insights/candidates/GainSaid';
import { RateTrack } from '@/components/features/insights/candidates/RateTrack';
import { InfoNote } from '@/components/features/insights/InfoNote';
import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { countShown } from '@/lib/insights';
import {
  type Adoption,
  changeLinkOf,
  comparedCosts,
  comparedRates,
  heldOutBrief,
  originNote,
  originShown,
  type SetCandidate,
} from '@/lib/insights-candidates';
import { percentShown } from '@/lib/judge';
import { pillClass } from '@/lib/pill';
import type { ReplayedStation } from '@/lib/replay';
import type { GainVerdictCode } from '@/lib/replay-words';
import { costPerRunShown } from '@/lib/search';
import { changeBrief, configChangesOf } from '@/lib/station-config';

const INKS: Record<GainVerdictCode, string> = {
  better: 'var(--chart-success)',
  worse: 'var(--destructive)',
  'within-noise': 'var(--chart-axis)',
};

type CandidateComparisonRowProps = {
  at: ReplayedStation;
  candidate: SetCandidate;
  adoption: Adoption | null;
  heldOut: boolean;
};

export function CandidateComparisonRow({
  at,
  candidate,
  adoption,
  heldOut,
}: CandidateComparisonRowProps) {
  const rates = comparedRates(candidate);
  const costs = comparedCosts(candidate);
  const changes = configChangesOf(candidate.changes);
  const link = changeLinkOf(at, candidate);

  return (
    <li
      data-slot="replayed-candidate"
      className="col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2.5 last:pb-1 @4xl:grid-cols-subgrid"
    >
      <div className="col-span-full flex min-w-0 flex-col gap-0.5 @4xl:col-span-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 truncate font-medium text-foreground text-xs">
            {candidate.name}
          </span>
          {adoption && <AdoptedPill adoption={adoption} />}
          {candidate.replayState && candidate.replayState !== 'finished' && (
            <ReplayStatePill
              state={candidate.replayState}
              className="gap-1 py-0 pr-1.5 pl-1.5 text-[0.7rem]"
            />
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {changes.length > 0
            ? changes.map(changeBrief).join(', ')
            : 'Same as the live config'}
        </p>
      </div>

      <ComparisonCell heading="Source" numeric={false}>
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          {originShown(candidate)}
          <InfoNote note={originNote(candidate)} />
        </span>
      </ComparisonCell>

      <div className="col-span-full min-w-0 @4xl:col-span-1">
        <RateTrack
          rate={rates.own}
          interval={rates.interval}
          live={rates.live}
          ink={
            candidate.againstLive
              ? INKS[candidate.againstLive.verdict]
              : undefined
          }
        />
      </div>

      <ComparisonCell heading="Candidate" strong>
        {percentShown(rates.own)}
      </ComparisonCell>
      <ComparisonCell heading="Live">{percentShown(rates.live)}</ComparisonCell>
      <ComparisonCell heading="Against live" numeric={false}>
        <GainSaid gain={candidate.againstLive} />
      </ComparisonCell>
      <ComparisonCell heading="Cost per run" strong>
        {costPerRunShown(costs.own, candidate.currency)}
      </ComparisonCell>
      <ComparisonCell heading="Live cost">
        {costs.live === null
          ? '–'
          : costPerRunShown(costs.live, candidate.currency)}
      </ComparisonCell>
      {heldOut && (
        <ComparisonCell heading="Held out">
          {heldOutBrief(candidate)}
        </ComparisonCell>
      )}
      <ComparisonCell heading="Runs">{countShown(rates.runs)}</ComparisonCell>

      {link.external ? (
        <a
          href={link.to}
          target="_blank"
          rel="noreferrer"
          className={pillClass(
            'outline',
            'justify-self-start whitespace-nowrap @4xl:justify-self-end',
          )}
        >
          {link.label}
          <ExternalLink aria-hidden className="size-3" />
        </a>
      ) : (
        <TrailLink
          to={link.to}
          className={pillClass(
            'outline',
            'justify-self-start whitespace-nowrap @4xl:justify-self-end',
          )}
        >
          {link.label}
        </TrailLink>
      )}
    </li>
  );
}
