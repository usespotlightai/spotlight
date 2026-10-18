import { Spool, X } from 'lucide-react';
import { BriefedMemory } from '@/components/features/runs/memories/BriefedMemory';
import { MemoryGroup } from '@/components/features/runs/memories/MemoryGroup';
import { ProposedMemoryItem } from '@/components/features/runs/memories/ProposedMemoryItem';
import { RunMemoriesDetailSkeleton } from '@/components/features/runs/memories/RunMemoriesDetailSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { type PaneConfig, SidePane } from '@/components/shared/SidePane';
import { useRunMemories } from '@/hooks/api/useRunMemories';
import { suppliedMemories } from '@/lib/memory';
import { failed, loading } from '@/lib/query';

const MEMORIES_PANE: PaneConfig = {
  storageKey: 'spotlight.run-memories-width',
  min: 288,
  max: 720,
  initial: 440,
  label: 'Resize the run’s memories',
};

type RunMemoriesDetailProps = {
  slug: string;
  teamId: string;
  runId: string;
  open: boolean;
  onClose: () => void;
};

export function RunMemoriesDetail({
  slug,
  teamId,
  runId,
  open,
  onClose,
}: RunMemoriesDetailProps) {
  const query = useRunMemories(teamId, runId);
  const memories = query.data;
  const supplied = memories ? suppliedMemories(memories) : [];

  return (
    <SidePane pane={MEMORIES_PANE} open={open}>
      <div className="flex items-center gap-1.5 px-4 py-2 text-xs">
        <Spool aria-hidden className="size-3.5 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate font-medium text-foreground">
          Memories
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the run’s memories"
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 scrollbar-hide">
        {loading(query) ? (
          <RunMemoriesDetailSkeleton />
        ) : failed(query) || !memories ? (
          <CouldNotLoad
            what="The run’s memories"
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
            className="items-start"
          />
        ) : (
          <>
            {supplied.length > 0 && (
              <MemoryGroup title="Supplied to the agent">
                {supplied.map((memory) => (
                  <BriefedMemory
                    key={memory.id}
                    slug={slug}
                    teamId={teamId}
                    memory={memory}
                  />
                ))}
              </MemoryGroup>
            )}

            {memories.proposed.length > 0 && (
              <MemoryGroup title="Proposed by this run">
                {memories.proposed.map((proposal) => (
                  <ProposedMemoryItem
                    key={proposal.id}
                    slug={slug}
                    teamId={teamId}
                    proposal={proposal}
                    reviewItemId={memories.reviewItemId}
                  />
                ))}
              </MemoryGroup>
            )}
          </>
        )}
      </div>
    </SidePane>
  );
}
