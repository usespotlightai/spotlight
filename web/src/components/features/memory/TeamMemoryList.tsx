import { TeamMemoryResults } from '@/components/features/memory/TeamMemoryResults';
import { ViewPills } from '@/components/shared/ViewPills';
import { useTeamMemories } from '@/hooks/api/useTeamMemories';
import type { LineResponseDto } from '@/lib/api';
import { type MemoryFilter, STANDING_VIEWS } from '@/lib/memory';

type TeamMemoryListProps = {
  slug: string;
  teamId: string;
  filter: MemoryFilter;
  lines: readonly LineResponseDto[];
  onFilter: (next: MemoryFilter) => void;
};

export function TeamMemoryList({
  slug,
  teamId,
  filter,
  lines,
  onFilter,
}: TeamMemoryListProps) {
  const memories = useTeamMemories(teamId, filter);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewPills
        views={STANDING_VIEWS}
        current={filter.standing}
        onChange={(standing) => onFilter({ ...filter, standing })}
      />

      <TeamMemoryResults
        slug={slug}
        teamId={teamId}
        filter={filter}
        lines={lines}
        memories={memories}
      />
    </div>
  );
}
