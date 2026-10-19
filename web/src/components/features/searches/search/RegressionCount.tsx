import { WithTooltip } from '@/components/shared/WithTooltip';
import type { SearchRegressions } from '@/lib/search';
import { NO_VALUE, regressionsNote } from '@/lib/search-words';

export function RegressionCount({
  regressions,
}: {
  regressions: SearchRegressions;
}) {
  if (regressions.total === null) {
    return NO_VALUE;
  }

  const count = <span data-slot="regressions">{regressions.total}</span>;

  const note = regressionsNote(regressions);

  return regressions.total > 0 && (note.rows?.length ?? 0) > 0 ? (
    <WithTooltip tooltip={note}>{count}</WithTooltip>
  ) : (
    count
  );
}
