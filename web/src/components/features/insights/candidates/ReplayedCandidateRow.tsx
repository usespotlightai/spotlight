import { ExternalLink } from 'lucide-react';
import { ChangedFromLive } from '@/components/features/replays/ChangedFromLive';
import { GainVerdict } from '@/components/features/replays/GainVerdict';
import { HeldOutScore } from '@/components/features/replays/HeldOutScore';
import { RateWithInterval } from '@/components/features/replays/RateWithInterval';
import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { ScoredRate } from '@/components/features/replays/ScoredRate';
import { Pill } from '@/components/shared/Pill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  changeLinkOf,
  comparedShown,
  costAgainstLiveShown,
  heldOutShown,
  markShown,
  onTheSameShown,
  type SetCandidate,
  tasksShown,
  VERSUS_LIVE,
} from '@/lib/insights-candidates';
import { type ReplayedStation, replayPath } from '@/lib/replay';
import { costPerRunShown } from '@/lib/search';
import { configChangesOf } from '@/lib/station-config';

const LINK =
  'flex items-center gap-1 text-foreground underline-offset-2 hover:underline';

type ReplayedCandidateRowProps = {
  at: ReplayedStation;
  candidate: SetCandidate;
};

export function ReplayedCandidateRow({
  at,
  candidate,
}: ReplayedCandidateRowProps) {
  const heldOut = heldOutShown(candidate);
  const change = changeLinkOf(at, candidate);
  const costAgainstLive = costAgainstLiveShown(candidate);
  const comparison = candidate.live ? replayPath(at, candidate.replayId) : null;
  const merged = !change.external && change.to === comparison;

  return (
    <li
      data-slot="replayed-candidate"
      className="flex min-w-0 flex-col gap-1.5 py-2 text-sm"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 truncate font-medium font-mono text-foreground">
          {candidate.name}
        </span>
        <Pill>{markShown(candidate.kind)}</Pill>
        {candidate.onFrontier && (
          <Pill className="text-primary">On the frontier</Pill>
        )}
        {candidate.replayState && candidate.replayState !== 'finished' && (
          <ReplayStatePill state={candidate.replayState} />
        )}
      </div>

      {candidate.hypothesis && (
        <p className="whitespace-pre-line text-foreground text-sm leading-6">
          {candidate.hypothesis}
        </p>
      )}

      <ChangedFromLive
        changes={configChangesOf(candidate.changes)}
        same="The same as the live config."
      />

      <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
        <div className="flex gap-1">
          <dt>Replayed</dt>
          <dd className="text-foreground tabular-nums">
            {tasksShown(candidate.tasks, candidate.runs)}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>
            {candidate.kind === 'searched' ? 'Search score' : 'Replay success'}
          </dt>
          <dd>
            <ScoredRate
              rate={candidate.successRate}
              interval={candidate.interval}
              scored={candidate.scored}
            />
          </dd>
        </div>
        {heldOut && (
          <div data-slot="held-out" className="flex gap-1">
            <dt>Held out</dt>
            <dd className="text-foreground tabular-nums">
              <HeldOutScore
                rate={candidate.heldOut?.score ?? null}
                interval={candidate.heldOut?.interval ?? null}
                runs={candidate.heldOut?.runs ?? null}
                unscored={heldOut}
              />
            </dd>
          </div>
        )}
        <div className="flex gap-1">
          <dt>Cost per run</dt>
          <dd className="text-foreground tabular-nums">
            {costPerRunShown(candidate.costPerRun, candidate.currency)}
          </dd>
        </div>
      </dl>

      {candidate.live && candidate.compared > 0 && (
        <div
          data-slot="against-live"
          className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs"
        >
          <span className="text-foreground tabular-nums">
            <RateWithInterval
              rate={candidate.successRateOnCompared}
              interval={candidate.intervalOnCompared}
            />{' '}
            <span className="text-muted-foreground">{VERSUS_LIVE}</span>{' '}
            <RateWithInterval
              rate={candidate.live.successRate}
              interval={candidate.live.interval}
            />{' '}
            <span className="text-muted-foreground">
              {onTheSameShown(candidate.compared)}
            </span>
          </span>
          {candidate.againstLive && (
            <GainVerdict gain={candidate.againstLive} />
          )}
        </div>
      )}

      {candidate.compared > 0 && costAgainstLive && (
        <p
          data-slot="cost-against-live"
          className="text-muted-foreground text-xs tabular-nums"
        >
          {costAgainstLive}
        </p>
      )}

      <p data-slot="compared" className="text-muted-foreground text-xs">
        {comparedShown(candidate)}
      </p>

      <p className="flex flex-wrap gap-x-3 text-xs">
        {comparison && !merged && (
          <TrailLink to={comparison} className={LINK}>
            Baseline comparison
          </TrailLink>
        )}
        {merged ? (
          <TrailLink to={change.to} className={LINK}>
            Its changes and baseline comparison
          </TrailLink>
        ) : change.external ? (
          <a href={change.to} target="_blank" rel="noreferrer" className={LINK}>
            {change.label}
            <ExternalLink aria-hidden className="size-3" />
          </a>
        ) : (
          <TrailLink to={change.to} className={LINK}>
            {change.label}
          </TrailLink>
        )}
      </p>
    </li>
  );
}
