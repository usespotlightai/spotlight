import type { UseQueryResult } from '@tanstack/react-query';
import { Spool } from 'lucide-react';
import { NewMemoryRow } from '@/components/features/memory/NewMemoryRow';
import { TeamMemoryRow } from '@/components/features/memory/TeamMemoryRow';
import { TeamMemorySkeleton } from '@/components/features/memory/TeamMemorySkeleton';
import { TeamMemoryTable } from '@/components/features/memory/TeamMemoryTable';
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
  opened: string | null;
  writing: boolean;
  onWritten: () => void;
  lines: readonly LineResponseDto[];
  memories: UseQueryResult<TeamMemory[]>;
};

export function TeamMemoryResults({
  slug,
  teamId,
  filter,
  opened,
  writing,
  onWritten,
  lines,
  memories,
}: TeamMemoryResultsProps) {
  const held = memories.data ?? [];

  const rows = held.map((memory) => (
    <TeamMemoryRow
      key={memory.id}
      slug={slug}
      teamId={teamId}
      memory={memory}
      lines={lines}
      startsOpen={memory.id === opened}
    />
  ));

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

  if (writing) {
    return (
      <TeamMemoryTable>
        <NewMemoryRow teamId={teamId} lines={lines} onDone={onWritten} />
        {rows}
      </TeamMemoryTable>
    );
  }

  if (held.length === 0 && !narrowed(filter) && filter.standing === 'stands') {
    return (
      <Notice>
        <EmptyState
          icon={Spool}
          title="No memories yet"
          action={<WriteMemoryButton />}
        >
          Stations that keep memories propose them after runs. Approve them in
          the inbox, or write one yourself.
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

  return <TeamMemoryTable>{rows}</TeamMemoryTable>;
}
