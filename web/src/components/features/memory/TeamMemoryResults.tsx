import type { UseQueryResult } from '@tanstack/react-query';
import { Spool } from 'lucide-react';
import { useState } from 'react';
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
  lines: UseQueryResult<LineResponseDto[]>;
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
  const listed = memories.data ?? [];
  const known = lines.data ?? [];
  const [openId, setOpenId] = useState(opened);
  const [followed, setFollowed] = useState(opened);

  if (opened !== followed) {
    setFollowed(opened);
    setOpenId(opened);
  }

  const rows = listed.map((memory) => (
    <TeamMemoryRow
      key={memory.id}
      slug={slug}
      teamId={teamId}
      memory={memory}
      lines={known}
      open={memory.id === openId}
      onOpenChange={(open) =>
        setOpenId((was) => (open ? memory.id : was === memory.id ? null : was))
      }
    />
  ));

  if (failed(memories) || failed(lines)) {
    return (
      <Notice>
        <CouldNotLoad
          what="The team’s memory"
          retrying={memories.isFetching || lines.isFetching}
          onRetry={() => {
            for (const query of [memories, lines]) {
              if (failed(query)) {
                void query.refetch();
              }
            }
          }}
        />
      </Notice>
    );
  }

  if (loading(memories) || loading(lines)) {
    return <TeamMemorySkeleton />;
  }

  if (writing) {
    return (
      <TeamMemoryTable>
        <NewMemoryRow teamId={teamId} lines={known} onDone={onWritten} />
        {rows}
      </TeamMemoryTable>
    );
  }

  if (listed.length === 0 && !narrowed(filter) && filter.status === 'active') {
    return (
      <Notice>
        <EmptyState
          icon={Spool}
          title="No memories yet"
          action={<WriteMemoryButton />}
        >
          Stations that use memories propose them after runs. Approve them in
          the inbox, or write one yourself.
        </EmptyState>
      </Notice>
    );
  }

  if (listed.length === 0) {
    return (
      <Notice>
        <p className="text-muted-foreground text-sm">
          {filter.status === 'retired'
            ? 'No retired memories match.'
            : 'No memories match.'}
        </p>
      </Notice>
    );
  }

  return <TeamMemoryTable>{rows}</TeamMemoryTable>;
}
