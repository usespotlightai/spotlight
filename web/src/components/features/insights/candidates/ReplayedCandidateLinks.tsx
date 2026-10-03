import { ExternalLink } from 'lucide-react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { changeLinkOf, type SetCandidate } from '@/lib/insights-candidates';
import { type ReplayedStation, replayPath } from '@/lib/replay';

const LINK =
  'flex items-center gap-1 text-foreground underline-offset-2 hover:underline';

type ReplayedCandidateLinksProps = {
  at: ReplayedStation;
  candidate: SetCandidate;
};

export function ReplayedCandidateLinks({
  at,
  candidate,
}: ReplayedCandidateLinksProps) {
  const change = changeLinkOf(at, candidate);
  const comparison = candidate.live ? replayPath(at, candidate.replayId) : null;
  const merged = !change.external && change.to === comparison;

  return (
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
  );
}
