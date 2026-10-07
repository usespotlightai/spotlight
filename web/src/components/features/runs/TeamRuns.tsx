import { Play } from 'lucide-react';
import { RunRow } from '@/components/features/runs/RunRow';
import { TeamRunsSkeleton } from '@/components/features/runs/TeamRunsSkeleton';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { Notice } from '@/components/shared/Notice';
import { ViewPills } from '@/components/shared/ViewPills';
import { Disclosure } from '@/components/shell/layout/Disclosure';
import { DisclosureRow } from '@/components/shell/layout/DisclosureRow';
import { useTeamRuns } from '@/hooks/api/useTeamRuns';
import { useCollapsed } from '@/hooks/useCollapsed';
import { useRemembered } from '@/hooks/useRemembered';
import { inboxItemPath } from '@/lib/inbox';
import { failed, loading } from '@/lib/query';
import {
  asRunFilter,
  byAge,
  FALLBACK_RUN_FILTER,
  inRunFilter,
  RUN_FILTERS,
  runPath,
} from '@/lib/run';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'spotlight.collapsed-run-ages';
const FILTER_KEY = 'spotlight.run-filter';

export function TeamRuns({ slug, teamId }: { slug: string; teamId: string }) {
  const runs = useTeamRuns(teamId);
  const ages = useCollapsed(STORAGE_KEY);
  const [held, remember] = useRemembered(FILTER_KEY, FALLBACK_RUN_FILTER);
  const filter = asRunFilter(held);

  if (failed(runs)) {
    return (
      <Notice>
        <CouldNotLoad
          what="Runs"
          retrying={runs.isFetching}
          onRetry={() => void runs.refetch()}
        />
      </Notice>
    );
  }

  if (runs.data?.length === 0) {
    return (
      <Notice>
        <EmptyState
          icon={Play}
          title="No runs yet"
          action={<CreateTaskLink slug={slug} teamId={teamId} />}
        >
          A run starts when a station picks up a task. Create a task to start
          one.
        </EmptyState>
      </Notice>
    );
  }

  const shown = (runs.data ?? []).filter((run) => inRunFilter(filter, run));

  return (
    <>
      <ViewPills views={RUN_FILTERS} current={filter} onChange={remember} />

      {loading(runs) ? (
        <TeamRunsSkeleton />
      ) : shown.length === 0 ? (
        <Notice>
          <p className="text-muted-foreground text-sm">
            Nothing is waiting for you. Switch to All to see every run.
          </p>
        </Notice>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-1.5">
          {byAge(shown).map(([age, held], at) => (
            <section
              key={age}
              className={cn('flex flex-col', at === 0 && 'pt-1.5')}
            >
              <DisclosureRow
                label={age}
                count={held.length}
                open={ages.isExpanded(age)}
                onToggle={() => ages.toggle(age)}
                chevron="start"
                className="sticky top-0 z-20 mx-1.5 h-9 w-auto bg-accent px-3 font-medium text-foreground text-xs"
              />

              <Disclosure open={ages.isExpanded(age)} className="px-1.5">
                {held.map((run) => (
                  <RunRow
                    key={run.id}
                    run={run}
                    gutter
                    to={runPath(slug, teamId, run.id)}
                    taskTitle={run.taskTitle}
                    reviewTo={
                      run.review
                        ? inboxItemPath(slug, run.review.conversationId, run.id)
                        : undefined
                    }
                  />
                ))}
              </Disclosure>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
