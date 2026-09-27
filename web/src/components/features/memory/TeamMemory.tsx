import { Brain } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { MemoryFilters } from '@/components/features/memory/MemoryFilters';
import { TeamMemoryRow } from '@/components/features/memory/TeamMemoryRow';
import { TeamMemorySkeleton } from '@/components/features/memory/TeamMemorySkeleton';
import { WriteMemoryButton } from '@/components/features/memory/WriteMemoryButton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { Notice } from '@/components/shared/Notice';
import { useLines } from '@/hooks/api/useLines';
import { useTeamMemories } from '@/hooks/api/useTeamMemories';
import { filterOf, narrowed, paramsOf } from '@/lib/memory';
import { failed, loading } from '@/lib/query';

type TeamMemoryProps = {
  slug: string;
  teamId: string;
};

export function TeamMemory({ slug, teamId }: TeamMemoryProps) {
  const [params, setParams] = useSearchParams();
  const filter = filterOf(params);
  const memories = useTeamMemories(teamId, filter);
  const lines = useLines(teamId).data ?? [];

  const held = memories.data ?? [];
  const nothingYet =
    held.length === 0 && !narrowed(filter) && filter.standing === 'stands';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <MemoryFilters
        filter={filter}
        lines={lines}
        onChange={(next) => setParams(paramsOf(next), { replace: true })}
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
            icon={Brain}
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
