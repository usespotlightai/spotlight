import { useParams } from 'react-router';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { TraceView } from '@/components/trace/TraceView';
import { useTasks } from '@/hooks/api/useTasks';
import { useTaskTrace } from '@/hooks/api/useTaskTrace';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { teamPath, teamSectionPath } from '@/lib/team';

export function TaskTrace() {
  const { slug, teamId, taskId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { data: tasks, isPending } = useTasks(teamId);
  const { data: trace } = useTaskTrace(teamId, taskId);

  if (isPending || !slug || !teamId || !taskId) {
    return null;
  }

  const task = tasks?.find((candidate) => candidate.id === taskId);
  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  return (
    <>
      <PageHeader
        title={
          <Breadcrumbs
            segments={[
              ...(team
                ? [
                    {
                      label: team.name,
                      icon: (
                        <InitialAvatar name={team.name} className="bg-card" />
                      ),
                      to: teamPath(slug, teamId),
                    },
                  ]
                : []),
              {
                label: 'Observability',
                to: teamSectionPath(slug, teamId, 'observability'),
              },
              { label: task?.title ?? 'Task' },
            ]}
          />
        }
      />

      {trace && <TraceView trace={trace} />}
    </>
  );
}
