import { useParams } from 'react-router';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { TraceView } from '@/components/trace/TraceView';
import { useTasks } from '@/hooks/api/useTasks';
import { useTaskTrace } from '@/hooks/api/useTaskTrace';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { teamPath, teamSectionPath } from '@/lib/team';
import { useTrail } from '@/lib/trail';

export function TaskTrace() {
  const { slug, teamId, taskId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { data: tasks, isPending } = useTasks(teamId);
  const { data: trace } = useTaskTrace(teamId, taskId);

  const task = tasks?.find((candidate) => candidate.id === taskId);
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
            label: 'Observability',
            to: teamSectionPath(slug, teamId, 'observability'),
          },
          { label: task?.title ?? 'Task' },
        ]
      : [];
  const { trail } = useTrail(base);

  if (isPending || !slug || !teamId || !taskId) {
    return null;
  }

  return (
    <>
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      {trace && <TraceView trace={trace} />}
    </>
  );
}
