import { SearchBestName } from '@/components/features/searches/station/SearchBestName';
import { SearchBestScore } from '@/components/features/searches/station/SearchBestScore';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type ReplayedStation, spendOfCeiling } from '@/lib/replay';
import { ongoing, type Search, searchLabel, searchPath } from '@/lib/search';
import { formatSearchState, formatStopReason } from '@/lib/search-words';
import { since } from '@/lib/since';
import { cn } from '@/lib/utils';

type SearchRowProps = {
  at: ReplayedStation;
  search: Search;
  number: number | null;
  setName: string | null;
};

export function SearchRow({ at, search, number, setName }: SearchRowProps) {
  return (
    <li data-slot="search" className={cn(TABLE_ROW, ROW_DIVIDER)}>
      <span className={cn(LEAD_CELL, EDGE_INDENT)}>
        <TrailLink
          to={searchPath(at, search.id)}
          className="truncate font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:underline"
        >
          {searchLabel(number)}
        </TrailLink>
      </span>
      <NestedCell heading="State" numeric={false}>
        <span
          title={
            search.stopReason ? formatStopReason(search.stopReason) : undefined
          }
          className={
            ongoing(search.state) ? 'text-foreground' : 'text-muted-foreground'
          }
        >
          {formatSearchState(search.state)}
        </span>
      </NestedCell>
      <NestedCell heading="Replay set" numeric={false}>
        {setName ?? '–'}
      </NestedCell>
      <NestedCell heading="Best" numeric={false}>
        <SearchBestName
          best={search.best}
          objective={search.objective}
          maxRegressions={search.maxRegressions}
        />
      </NestedCell>
      <NestedCell heading="Success">
        <SearchBestScore best={search.best} />
      </NestedCell>
      <NestedCell heading="Iterations">
        {search.iterationsRun} / {search.budget.iterations}
      </NestedCell>
      <NestedCell heading="Spent">
        {spendOfCeiling(search.spent, search.budget.ceiling)}
      </NestedCell>
      <NestedCell heading="Started">{since(search.startedAt)}</NestedCell>
    </li>
  );
}
