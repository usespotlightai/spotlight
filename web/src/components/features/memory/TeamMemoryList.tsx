import { Spool } from 'lucide-react';
import { TeamMemoryRow } from '@/components/features/memory/TeamMemoryRow';
import { TeamMemorySkeleton } from '@/components/features/memory/TeamMemorySkeleton';
import { WriteMemoryButton } from '@/components/features/memory/WriteMemoryButton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { Notice } from '@/components/shared/Notice';
import { ViewPills } from '@/components/shared/ViewPills';
import { useTeamMemories } from '@/hooks/api/useTeamMemories';
import type { LineResponseDto } from '@/lib/api';
import { type MemoryFilter, narrowed, STANDING_VIEWS } from '@/lib/memory';
import { failed, loading } from '@/lib/query';

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

  const held = memories.data ?? [];
  const nothingYet =
    held.length === 0 && !narrowed(filter) && filter.standing === 'stands';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ViewPills
        views={STANDING_VIEWS}
        current={filter.standing}
        onChange={(standing) => onFilter({ ...filter, standing })}
      />

      {failed(memories) ? (
        <Notice>
          <CouldNotLoad
            what="The team’s memory"
            retrying={memories.isFetching}
            onRetry={() => void memories.refetch()}
          />
        </Notice>
      ) : loading(memories) ? (
        <TeamMemorySkeleton />
      ) : nothingYet ? (
        <Notice>
          <EmptyState
            icon={Spool}
            title="Nothing remembered yet"
            action={<WriteMemoryButton teamId={teamId} />}
          >
            Memories come from runs at stations that keep them, once someone
            approves them in the inbox. You can also write one yourself.
          </EmptyState>
        </Notice>
      ) : held.length === 0 ? (
        <Notice>
          <p className="text-muted-foreground text-sm">
            {filter.standing === 'retired'
              ? 'No retired memories match.'
              : 'No memories match.'}
          </p>
        </Notice>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
          {held.map((memory) => (
            <TeamMemoryRow
              key={memory.id}
              slug={slug}
              teamId={teamId}
              memory={memory}
              lines={lines}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
