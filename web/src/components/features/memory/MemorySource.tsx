import { MemoryProvenanceList } from '@/components/features/memory/MemoryProvenanceList';
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
    return null;
  }

  const memory = query.data;
  const { provenance } = memory;

  return (
    <div className="flex flex-col gap-2">
      {citesAnything(memory) && (
        <MemoryProvenanceList provenance={memory} compact />
      )}
      {provenance && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-3',
            citesAnything(memory) ? 'pl-8.5' : 'pl-1.5',
          )}
        >
          <SectionLink
            to={runPath(slug, teamId, provenance.runId)}
            className="hover:bg-border/70"
          >
            Open its run
          </SectionLink>
          <SectionLink
            to={taskPath(slug, teamId, provenance.taskId)}
            className="hover:bg-border/70"
          >
            Open its task
          </SectionLink>
        </div>
      )}
    </div>
  );
}
