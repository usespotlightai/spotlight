import { Activity } from 'lucide-react';
import { useParams } from 'react-router';
import { TraceView } from '@/components/features/trace/view/TraceView';
import { TraceViewSkeleton } from '@/components/features/trace/view/TraceViewSkeleton';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageNotice } from '@/components/shared/PageNotice';
import { TrailSkeleton } from '@/components/shared/skeleton/TrailSkeleton';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';
import { useTasks } from '@/hooks/api/useTasks';
import { useTaskTrace } from '@/hooks/api/useTaskTrace';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { failed, loading } from '@/lib/query';
import { taskPath } from '@/lib/task';
import { teamPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';
import { cn } from '@/lib/utils';

export function TaskTrace() {
  const { slug, teamId, taskId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const tasks = useTasks(teamId);
  const trace = useTaskTrace(teamId, taskId);

  const task = tasks.data?.find((candidate) => candidate.id === taskId);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  const base: BreadcrumbSegment[] =
    slug && teamId
      ? [
          ...(team
            ? [
                {
                  label: team.name,
                  avatar: team.name,
                  to: teamPath(slug, teamId),
                },
              ]
            : []),
          {
            label: task?.title ?? 'Task',
            to: taskId ? taskPath(slug, teamId, taskId) : undefined,
          },
          { label: 'Trace' },
        ]
      : [];
  const { trail, forward } = useTrail(base, 2);

  if (!slug || !teamId || !taskId) {
    return null;
  }

  const title = loading(tasks) ? (
    <TrailSkeleton known={trail.slice(0, -2)} />
  ) : (
    <Breadcrumbs segments={trail} />
  );

  if (failed(trace)) {
    return (
      <PageNotice title={title}>
        <CouldNotLoad
          what="The trace"
          retrying={trace.isFetching}
          onRetry={() => void trace.refetch()}
        />
      </PageNotice>
    );
  }

  if (trace.data?.roots.length === 0) {
    return (
      <TrailContext value={forward}>
        <PageNotice title={title}>
          <EmptyState
            icon={Activity}
            title="No runs yet"
            action={
              <TrailLink
                to={taskPath(slug, teamId, taskId)}
                className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}
              >
                Open the task
              </TrailLink>
            }
          >
            The trace fills in after a station works this task.
          </EmptyState>
        </PageNotice>
      </TrailContext>
    );
  }

  return (
    <>
      <PageHeader title={title} />

      {loading(trace) && <TraceViewSkeleton />}

      {trace.data && <TraceView trace={trace.data} teamId={teamId} />}
    </>
  );
}
