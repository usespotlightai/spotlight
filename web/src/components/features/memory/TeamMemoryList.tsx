import { MemoryTabs } from '@/components/features/memory/MemoryTabs';
import { TeamMemoryResults } from '@/components/features/memory/TeamMemoryResults';
import { useTeamMemories } from '@/hooks/api/useTeamMemories';
import type { LineResponseDto } from '@/lib/api';
import type { MemoryFilter } from '@/lib/memory';

type TeamMemoryListProps = {
  slug: string;
  teamId: string;
  filter: MemoryFilter;
  opened: string | null;
  writing: boolean;
  onWritten: () => void;
  lines: readonly LineResponseDto[];
};

export function TeamMemoryList({
  slug,
  teamId,
  filter,
  opened,
  writing,
  onWritten,
  lines,
}: TeamMemoryListProps) {
  const memories = useTeamMemories(teamId, filter);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MemoryTabs slug={slug} teamId={teamId} filter={filter} />

      <TeamMemoryResults
        slug={slug}
        teamId={teamId}
        filter={filter}
        opened={opened}
        writing={writing}
        onWritten={onWritten}
        lines={lines}
        memories={memories}
      />
    </div>
  );
}
