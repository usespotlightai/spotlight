import { MemoryGroundList } from '@/components/features/memory/MemoryGroundList';
import { SectionLink } from '@/components/shared/SectionLink';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { useTeamMemory } from '@/hooks/api/useTeamMemory';
import { citesAnything } from '@/lib/memory';
import { failed, loading } from '@/lib/query';
import { runPath } from '@/lib/run';
import { taskPath } from '@/lib/task';
import { cn } from '@/lib/utils';

type MemorySourceProps = {
  slug: string;
  teamId: string;
  memoryId: string;
};

export function MemorySource({ slug, teamId, memoryId }: MemorySourceProps) {
  const query = useTeamMemory(teamId, memoryId);

  if (loading(query)) {
    return (
      <span role="status" aria-label="Loading its source" className="flex">
        <SkeletonLine className="w-24" />
      </span>
    );
  }

  if (failed(query) || !query.data) {
    return <span>Sorry, its source couldn’t be loaded.</span>;
  }

  const memory = query.data;
  const { grounds } = memory;

  return (
    <div className="flex flex-col gap-2">
      {citesAnything(memory) && <MemoryGroundList grounds={memory} compact />}
      {grounds && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-3',
            citesAnything(memory) ? 'pl-8.5' : 'pl-1.5',
          )}
        >
          <SectionLink
            to={runPath(slug, teamId, grounds.runId)}
            className="hover:bg-border/70"
          >
            Open its run
          </SectionLink>
          <SectionLink
            to={taskPath(slug, teamId, grounds.taskId)}
            className="hover:bg-border/70"
          >
            Open its task
          </SectionLink>
        </div>
      )}
    </div>
  );
}
