import { CandidateIcons } from '@/components/features/searches/CandidateIcons';
import type { SearchBestResponseDto } from '@/lib/api';
import { formatNoBest, type SearchObjective } from '@/lib/search-words';

type SearchBestNameProps = {
  best: SearchBestResponseDto | null;
  objective: SearchObjective;
  maxRegressions: number | null;
};

export function SearchBestName({
  best,
  objective,
  maxRegressions,
}: SearchBestNameProps) {
  if (!best) {
    return (
      <span className="text-muted-foreground">{formatNoBest(objective)}</span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-foreground">
        {best.isSeed ? 'Live config' : best.name}
      </span>
      <CandidateIcons candidate={best} maxRegressions={maxRegressions} />
    </span>
  );
}
