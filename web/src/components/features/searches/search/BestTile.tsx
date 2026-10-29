import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { CandidateIcons } from '@/components/features/searches/CandidateIcons';
import { formatPercent } from '@/lib/judge';
import { LIVE_CONFIG_LABEL } from '@/lib/replay-words';
import { formatCostPerRun, type SearchDetail } from '@/lib/search';
import {
  estimatedRateRows,
  formatAims,
  formatBestOn,
  formatBestTerm,
  formatCheapest,
  formatNoBest,
  formatSuccessOn,
  NO_VALUE,
} from '@/lib/search-words';

export function BestTile({ search }: { search: SearchDetail }) {
  const { best, objective } = search;
  const aims = formatAims(objective);

  if (!best) {
    return (
      <InsightsTile
        label={formatBestTerm(objective)}
        value={NO_VALUE}
        detail={formatNoBest(objective)}
        tooltip={aims}
      />
    );
  }

  const heldOut = best.heldOutScore !== null;
  const rate = heldOut ? best.heldOutScore : best.searchScore;
  const currency = search.budget.ceiling.currency;
  const success =
    rate !== null && `${formatPercent(rate)} ${formatBestOn(heldOut)}`;
  const cost = objective === 'cost';

  return (
    <InsightsTile
      label={formatBestTerm(objective)}
      value={best.isSeed ? LIVE_CONFIG_LABEL : best.name}
      detail={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {cost
            ? formatCheapest(
                formatCostPerRun(best.costPerRun, currency),
                best.isSeed
                  ? null
                  : formatCostPerRun(search.seed.costPerRun, currency),
              )
            : success}
          <CandidateIcons
            candidate={best}
            maxRegressions={search.maxRegressions}
          />
        </span>
      }
      tooltip={{
        body: aims,
        rows: [
          ...(cost && rate !== null
            ? [[formatSuccessOn(heldOut), formatPercent(rate)] as const]
            : []),
          ...estimatedRateRows(
            heldOut ? best.heldOutInterval : best.searchInterval,
          ),
        ],
      }}
    />
  );
}
