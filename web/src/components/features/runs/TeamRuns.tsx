import { RunRow } from '@/components/features/runs/RunRow';
import { Disclosure } from '@/components/shell/layout/Disclosure';
import { DisclosureRow } from '@/components/shell/layout/DisclosureRow';
import { useTeamRuns } from '@/hooks/api/useTeamRuns';
import { useCollapsed } from '@/hooks/useCollapsed';
import { inboxItemPath } from '@/lib/inbox';
import { byAge, runPath } from '@/lib/run';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'spotlight.collapsed-run-ages';

export function TeamRuns({ slug, teamId }: { slug: string; teamId: string }) {
  const { data: runs, isPending } = useTeamRuns(teamId);
  const ages = useCollapsed(STORAGE_KEY);

  if (isPending) {
    return null;
  }

  const worked = runs ?? [];

  if (worked.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">
          Nothing has been run for this team yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-1.5">
      {byAge(worked).map(([age, held], at) => (
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
  );
}
