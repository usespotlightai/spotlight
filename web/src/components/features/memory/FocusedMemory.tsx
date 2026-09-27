import { TeamMemoryRow } from '@/components/features/memory/TeamMemoryRow';
import { TeamMemorySkeleton } from '@/components/features/memory/TeamMemorySkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Notice } from '@/components/shared/Notice';
import { Button } from '@/components/ui/button';
import { useTeamMemory } from '@/hooks/api/useTeamMemory';
import type { LineResponseDto } from '@/lib/api';
import { failed, loading } from '@/lib/query';

type FocusedMemoryProps = {
  slug: string;
  teamId: string;
  memoryId: string;
  lines: readonly LineResponseDto[];
  onShowAll: () => void;
};

export function FocusedMemory({
  slug,
  teamId,
  memoryId,
  lines,
  onShowAll,
}: FocusedMemoryProps) {
  const memory = useTeamMemory(teamId, memoryId);

  const showAll = (
    <Button
      size="sm"
      variant="ghost"
      className="self-start"
      onClick={onShowAll}
    >
      Show every memory
    </Button>
  );

  if (loading(memory)) {
    return <TeamMemorySkeleton />;
  }

  if (memory.data === null) {
    return (
      <Notice>
        <div className="flex flex-col items-center gap-2">
          <p className="text-muted-foreground text-sm">
            There is no such memory for this team.
          </p>
          {showAll}
        </div>
      </Notice>
    );
  }

  if (failed(memory) || !memory.data) {
    return (
      <Notice>
        <div className="flex flex-col items-center gap-2">
          <CouldNotLoad
            what="This memory"
            retrying={memory.isFetching}
            onRetry={() => void memory.refetch()}
          />
          {showAll}
        </div>
      </Notice>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
      {showAll}
      <ul>
        <TeamMemoryRow
          slug={slug}
          teamId={teamId}
          memory={memory.data}
          lines={lines}
          startsOpen
        />
      </ul>
    </div>
  );
}
