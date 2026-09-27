import { Brain, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { RememberedGroup } from '@/components/features/runs/remembered/RememberedGroup';
import { RememberedMemory } from '@/components/features/runs/remembered/RememberedMemory';
import { RememberedProposal } from '@/components/features/runs/remembered/RememberedProposal';
import { RunRememberedSkeleton } from '@/components/features/runs/remembered/RunRememberedSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Unfold } from '@/components/shared/Unfold';
import { useRunMemories } from '@/hooks/api/useRunMemories';
import { rememberedNothing, rememberedSummary } from '@/lib/memory';
import { failed, loading } from '@/lib/query';
import { cn } from '@/lib/utils';

type RunRememberedProps = {
  slug: string;
  teamId: string;
  runId: string;
};

export function RunRemembered({ slug, teamId, runId }: RunRememberedProps) {
  const query = useRunMemories(teamId, runId);
  const [open, setOpen] = useState(false);

  if (loading(query)) {
    return <RunRememberedSkeleton />;
  }

  if (failed(query) || !query.data) {
    return (
      <CouldNotLoad
        what="What the run remembered"
        retrying={query.isFetching}
        onRetry={() => void query.refetch()}
        className="items-start"
      />
    );
  }

  const remembered = query.data;

  if (rememberedNothing(remembered)) {
    return (
      <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <Brain aria-hidden className="size-3.5" />
        The team remembered nothing for this run.
      </p>
    );
  }

  return (
    <div
      data-slot="run-remembered"
      className="flex flex-col gap-3 rounded-xl border border-border px-3 py-2.5"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className="flex items-center gap-1.5 text-left text-muted-foreground text-xs outline-none hover:text-foreground"
      >
        <Brain aria-hidden className="size-3.5" />
        <span className="font-medium text-foreground">Remembered</span>
        <span className="min-w-0 flex-1 truncate">
          {rememberedSummary(remembered)}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      <Unfold open={open} appear={false}>
        <div className="flex flex-col gap-4">
          {remembered.briefed.length > 0 && (
            <RememberedGroup
              title="Briefed"
              about="What the run was told before it started, the most specific first."
            >
              {remembered.briefed.map((memory) => (
                <RememberedMemory
                  key={memory.id}
                  slug={slug}
                  teamId={teamId}
                  memory={memory}
                />
              ))}
            </RememberedGroup>
          )}

          {remembered.cut.length > 0 && (
            <RememberedGroup
              title="Cut by the cap"
              about="What reached this run but was left out, since the briefing holds only so much; the nearest twenty at most."
            >
              {remembered.cut.map((memory) => (
                <RememberedMemory
                  key={memory.id}
                  slug={slug}
                  teamId={teamId}
                  memory={memory}
                  cut
                />
              ))}
            </RememberedGroup>
          )}

          {remembered.recalled.length > 0 && (
            <RememberedGroup
              title="Recalled"
              about="What the agent looked up with spotlight recall."
            >
              {remembered.recalled.map((memory) => (
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
            <RememberedGroup
              title="Proposed"
              about="What this run put to the team to keep."
            >
              {remembered.proposed.map((proposal) => (
                <RememberedProposal
                  key={proposal.id}
                  slug={slug}
                  teamId={teamId}
                  proposal={proposal}
                />
              ))}
            </RememberedGroup>
          )}
        </div>
      </Unfold>
    </div>
  );
}
