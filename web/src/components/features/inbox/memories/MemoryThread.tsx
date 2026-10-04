import { ProposedMemories } from '@/components/features/inbox/memories/ProposedMemories';
import { RunThread } from '@/components/features/inbox/RunThread';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';

type MemoryThreadProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  trail: readonly BreadcrumbSegment[];
};

export function MemoryThread({
  slug,
  teamId,
  taskId,
  runId,
  trail,
}: MemoryThreadProps) {
  return (
    <RunThread
      slug={slug}
      teamId={teamId}
      taskId={taskId}
      runId={runId}
      trail={trail}
      after={
        <ProposedMemories
          slug={slug}
          teamId={teamId}
          taskId={taskId}
          runId={runId}
        />
      }
    />
  );
}
