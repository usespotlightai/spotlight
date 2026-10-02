import { Pill } from '@/components/shared/Pill';
import { ongoing } from '@/lib/search';
import {
  endingShown,
  type SearchEnding,
  type SearchState,
  searchStateShown,
} from '@/lib/search-words';
import { cn } from '@/lib/utils';

type SearchStatePillProps = {
  state: SearchState;
  ending: SearchEnding | null;
  className?: string;
};

export function SearchStatePill({
  state,
  ending,
  className,
}: SearchStatePillProps) {
  const moving = ongoing(state);

  return (
    <Pill
      className={cn(
        moving ? 'text-foreground' : 'text-muted-foreground',
        className,
      )}
      lead={
        moving ? (
          <span
            aria-hidden
            className="size-1.5 animate-pulse rounded-full bg-current"
          />
        ) : undefined
      }
    >
      <span title={ending ? endingShown(ending) : undefined}>
        {searchStateShown(state)}
      </span>
    </Pill>
  );
}
