import { Spool, X } from 'lucide-react';
import { RememberedDetailSkeleton } from '@/components/features/runs/remembered/RememberedDetailSkeleton';
import { RememberedGroup } from '@/components/features/runs/remembered/RememberedGroup';
import { RememberedMemory } from '@/components/features/runs/remembered/RememberedMemory';
import { RememberedProposal } from '@/components/features/runs/remembered/RememberedProposal';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { type PaneConfig, SidePane } from '@/components/shared/SidePane';
import { useRunMemories } from '@/hooks/api/useRunMemories';
import { givenMemories } from '@/lib/memory';
import { failed, loading } from '@/lib/query';

const REMEMBERED_PANE: PaneConfig = {
  storageKey: 'spotlight.remembered-detail-width',
  min: 288,
  max: 720,
  initial: 440,
  label: 'Resize what the run remembered',
};

type RememberedDetailProps = {
  slug: string;
  teamId: string;
  runId: string;
  open: boolean;
  onClose: () => void;
};

export function RememberedDetail({
  slug,
  teamId,
  runId,
  open,
  onClose,
}: RememberedDetailProps) {
  const query = useRunMemories(teamId, runId);
  const remembered = query.data;
  const given = remembered ? givenMemories(remembered) : [];

  return (
    <SidePane pane={REMEMBERED_PANE} open={open}>
      <div className="flex items-center gap-1.5 px-4 py-2 text-xs">
        <Spool aria-hidden className="size-3.5 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate font-medium text-foreground">
          Remembered
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close what the run remembered"
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 scrollbar-hide">
        {loading(query) ? (
          <RememberedDetailSkeleton />
        ) : failed(query) || !remembered ? (
          <CouldNotLoad
            what="What the run remembered"
            retrying={query.isFetching}
            onRetry={() => void query.refetch()}
            className="items-start"
          />
        ) : (
          <>
            {given.length > 0 && (
              <RememberedGroup title="Given to the agent">
                {given.map((memory) => (
                  <RememberedMemory
                    key={memory.id}
                    slug={slug}
                    teamId={teamId}
                    memory={memory}
                  />
                ))}
              </RememberedGroup>
            )}

            {remembered.proposed.length > 0 && (
              <RememberedGroup title="Proposed by this run">
                {remembered.proposed.map((proposal) => (
                  <RememberedProposal
                    key={proposal.id}
                    slug={slug}
                    teamId={teamId}
                    proposal={proposal}
                    reviewItemId={remembered.reviewItemId}
                  />
                ))}
              </RememberedGroup>
            )}
          </>
        )}
      </div>
    </SidePane>
  );
}
