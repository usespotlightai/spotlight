import { Play } from 'lucide-react';
import { type ReactElement, useRef } from 'react';

import { RunRow } from '@/components/features/runs/RunRow';
import { TeamRunsSkeleton } from '@/components/features/runs/TeamRunsSkeleton';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { Notice } from '@/components/shared/Notice';
import { PillButton } from '@/components/shared/PillButton';
import { ShowMore } from '@/components/shared/ShowMore';
import { ViewPills } from '@/components/shared/ViewPills';
import { Disclosure } from '@/components/shell/layout/Disclosure';
import { DisclosureRow } from '@/components/shell/layout/DisclosureRow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useReadEveryPage } from '@/hooks/api/usePagedList';
import { usePrefetchTaskJournal } from '@/hooks/api/useTaskJournal';
import { useTeamRuns } from '@/hooks/api/useTeamRuns';
import { useCollapsed } from '@/hooks/useCollapsed';
import { useListKeys } from '@/hooks/useListKeys';
import { useStoredState } from '@/hooks/useStoredState';
import { inboxItemPath } from '@/lib/inbox';
import { nonEmpty } from '@/lib/non-empty';
import { failed, loading } from '@/lib/query';
import {
  ALL_RUNS,
  asRunFilter,
  byAge,
  inRunFilter,
  RUN_FILTERS,
  runPath,
} from '@/lib/run';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'spotlight.collapsed-run-ages';
const FILTER_KEY = 'spotlight.run-filter';

export function TeamRuns({
  slug,
  teamId,
}: {
  slug: string;
  teamId: string;
}): ReactElement {
  const prefetch = usePrefetchTaskJournal(slug);
  const runs = useTeamRuns(teamId);
  const ages = useCollapsed(STORAGE_KEY);
  const [stored, store] = useStoredState(FILTER_KEY, ALL_RUNS);
  const filter = asRunFilter(stored);
  const waiting = filter !== ALL_RUNS;
  const reading = useReadEveryPage(runs, waiting);
  const rows = useRef<HTMLDivElement>(null);
  useListKeys(rows);

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
  const older = !waiting ? (
    <ShowMore list={runs} what="Older runs" className="mt-2" />
  ) : runs.more.failed ? (
    <CouldNotLoad
      what="Older runs"
      retrying={runs.more.loading}
      onRetry={runs.more.load}
      className="py-4"
    />
  ) : null;

  return (
    <>
      <ViewPills views={RUN_FILTERS} current={filter} onChange={store} />

      {loading(runs) || (reading && shown.length === 0) ? (
        <TeamRunsSkeleton />
      ) : shown.length === 0 ? (
        <Notice>
          <div className="flex flex-col items-center gap-3">
            <EmptyState
              icon={Play}
              title="Nothing is waiting for you"
              action={
                <PillButton size="regular" onClick={() => store(ALL_RUNS)}>
                  Show all runs
                </PillButton>
              }
            >
              Runs with a review for you show here.
            </EmptyState>
            {older}
          </div>
        </Notice>
      ) : (
        <div ref={rows} className="contents">
          <ScrollArea
            className="min-h-0 flex-1"
            contentClassName="min-h-full flex flex-col gap-0.5 pb-1.5"
          >
            {byAge(shown).map(([age, ofAge], at) => (
              <section
                key={age}
                className={cn('flex flex-col', at === 0 && 'pt-1.5')}
              >
                <DisclosureRow
                  label={age}
                  count={ofAge.length}
                  open={ages.isExpanded(age)}
                  onToggle={() => ages.toggle(age)}
                  chevron="start"
                  className="sticky top-0 z-20 mx-1.5 h-9 w-auto bg-accent px-3 font-medium text-foreground text-xs"
                />

                <Disclosure open={ages.isExpanded(age)} className="px-1.5">
                  {ofAge.map((run) => (
                    <RunRow
                      key={run.id}
                      run={run}
                      teamId={teamId}
                      gutter
                      to={runPath(slug, teamId, run.id)}
                      onIntent={() =>
                        nonEmpty(run.taskId) && prefetch(run.taskId, [run.id])
                      }
                      taskTitle={run.taskTitle}
                      reviewTo={
                        run.review
                          ? inboxItemPath(
                              slug,
                              run.review.conversationId,
                              run.id,
                            )
                          : undefined
                      }
                    />
                  ))}
                </Disclosure>
              </section>
            ))}
            {older}
          </ScrollArea>
        </div>
      )}
    </>
  );
}
