import { FrontierMark } from '@/components/features/searches/FrontierMark';
import { OverfitMark } from '@/components/features/searches/OverfitMark';
import { RegressionLimitWarning } from '@/components/features/searches/RegressionLimitWarning';
import type { SearchCandidate } from '@/lib/search';

type CandidateIconsProps = {
  candidate: Pick<
    SearchCandidate,
    'overfit' | 'exceedsRegressionLimit' | 'regressions'
  >;
  maxRegressions: number | null;
  frontier?: boolean;
};

export function CandidateIcons({
  candidate,
  maxRegressions,
  frontier = false,
}: CandidateIconsProps) {
  const exceeds = candidate.exceedsRegressionLimit && maxRegressions !== null;

  if (!frontier && !candidate.overfit && !exceeds) {
    return null;
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {frontier && <FrontierMark />}
      {candidate.overfit && <OverfitMark mark={candidate.overfit} />}
      <RegressionLimitWarning
        candidate={candidate}
        maxRegressions={maxRegressions}
      />
    </span>
  );
}
