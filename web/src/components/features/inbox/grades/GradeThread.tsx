import { GradeRun } from '@/components/features/inbox/grades/GradeRun';
import { RunThread } from '@/components/features/inbox/RunThread';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';

type GradeThreadProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  trail: readonly BreadcrumbSegment[];
};

export function GradeThread({
  slug,
  teamId,
  taskId,
  runId,
  trail,
}: GradeThreadProps) {
  return (
    <RunThread
      slug={slug}
      teamId={teamId}
      taskId={taskId}
      runId={runId}
      trail={trail}
      after={<GradeRun slug={slug} teamId={teamId} runId={runId} />}
    />
  );
}
