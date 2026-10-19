import { WarningTooltip } from '@/components/shared/WarningTooltip';
import type { SearchCandidate } from '@/lib/search';
import {
  REGRESSION_LIMIT_EXCEEDED,
  regressionLimitNote,
} from '@/lib/search-words';

type RegressionLimitWarningProps = {
  candidate: Pick<SearchCandidate, 'exceedsRegressionLimit' | 'regressions'>;
  maxRegressions: number | null;
};

export function RegressionLimitWarning({
  candidate,
  maxRegressions,
}: RegressionLimitWarningProps) {
  if (!candidate.exceedsRegressionLimit || maxRegressions === null) {
    return null;
  }

  return (
    <WarningTooltip
      data-slot="regression-limit"
      tone="warning"
      label={REGRESSION_LIMIT_EXCEEDED}
      tooltip={regressionLimitNote(candidate.regressions, maxRegressions)}
      className="relative z-10"
    />
  );
}
