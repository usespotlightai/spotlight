import { SearchStatePill } from '@/components/features/searches/SearchStatePill';
import { BestCandidate } from '@/components/features/searches/station/BestCandidate';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type ReplayedStation, spendOfCeiling } from '@/lib/replay';
import { since } from '@/lib/runner';
import {
  iterationsShown,
  type Search,
  searchLabel,
  searchPath,
} from '@/lib/search';
import { endingShown } from '@/lib/search-words';

type SearchRowProps = {
  at: ReplayedStation;
  search: Search;
  number: number | null;
  setName: string | null;
};

export function SearchRow({ at, search, number, setName }: SearchRowProps) {
  return (
    <li
      data-slot="search"
      className="relative flex flex-col gap-1 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <TrailLink
          to={searchPath(at, search.id)}
          className="min-w-0 truncate font-medium text-foreground outline-none after:absolute after:inset-0 after:rounded-md focus-visible:underline"
        >
          {searchLabel(number)}
        </TrailLink>
        <SearchStatePill state={search.state} ending={search.ending} />
        <span className="text-muted-foreground text-xs">
          {setName ? `on ${setName} · ` : ''}started {since(search.startedAt)}
        </span>
        <BestCandidate best={search.best} className="sm:ml-auto" />
      </div>

      <p className="flex flex-wrap gap-x-1.5 text-muted-foreground text-xs tabular-nums">
        <span>{iterationsShown(search)}</span>
        <span>· {spendOfCeiling(search.spent, search.budget.ceiling)}</span>
        {search.ending && <span>· {endingShown(search.ending)}</span>}
      </p>
    </li>
  );
}
