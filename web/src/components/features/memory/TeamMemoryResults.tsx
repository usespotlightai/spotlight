import type { UseQueryResult } from '@tanstack/react-query';
import { Spool } from 'lucide-react';
import { TeamMemoryRow } from '@/components/features/memory/TeamMemoryRow';
import { TeamMemorySkeleton } from '@/components/features/memory/TeamMemorySkeleton';
import { WriteMemoryButton } from '@/components/features/memory/WriteMemoryButton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { Notice } from '@/components/shared/Notice';
import type { LineResponseDto } from '@/lib/api';
import { type MemoryFilter, narrowed, type TeamMemory } from '@/lib/memory';
import { failed, loading } from '@/lib/query';

type TeamMemoryResultsProps = {
  slug: string;
  teamId: string;
  filter: MemoryFilter;
  lines: readonly LineResponseDto[];
  memories: UseQueryResult<TeamMemory[]>;
};

export function TeamMemoryResults({
  slug,
  teamId,
  filter,
  lines,
  memories,
}: TeamMemoryResultsProps) {
  const held = memories.data ?? [];

  if (failed(memories)) {
    return (
      <Notice>
        <CouldNotLoad
          what="The team’s memory"
          retrying={memories.isFetching}
          onRetry={() => void memories.refetch()}
        />
      </Notice>
    );
  }

  if (loading(memories)) {
    return <TeamMemorySkeleton />;
  }

  if (held.length === 0 && !narrowed(filter) && filter.standing === 'stands') {
    return (
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
    );
  }

  if (held.length === 0) {
    return (
      <Notice>
        <p className="text-muted-foreground text-sm">
          {filter.standing === 'retired'
            ? 'No retired memories match.'
            : 'No memories match.'}
        </p>
      </Notice>
    );
  }

  return (
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
  );
}
