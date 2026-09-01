import { useParams } from 'react-router';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { TraceView } from '@/components/trace/TraceView';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useTaskRuns } from '@/hooks/api/useTaskRuns';
import { useTasks } from '@/hooks/api/useTasks';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { taskPath } from '@/lib/task';
import { teamPath } from '@/lib/team';

/**
 * One task's trace, given the whole page. The breadcrumb back to the task is
 * the way out, so nothing here needs a control of its own for it.
 */
export function TaskTrace() {
  const { slug, teamId, taskId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { data: tasks, isPending } = useTasks(teamId);
  const { data: runs } = useTaskRuns(teamId, taskId);
  const { data: journals } = useTaskJournal(slug, taskId);

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
                label: task?.title ?? 'Task',
                to: taskPath(slug, teamId, taskId),
              },
              { label: 'Trace' },
            ]}
          />
        }
      />

      <TraceView runs={runs ?? []} journals={journals ?? []} />
    </>
  );
}
