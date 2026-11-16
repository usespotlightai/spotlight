import { ChangesRow } from '@/components/features/changes/ChangesRow';
import { useTaskChangeStack } from '@/hooks/api/useTaskChangeStack';
import { taskChangesPath } from '@/lib/change-stack';

type TaskChangesLinkProps = {
  slug: string;
  teamId: string;
  taskId: string;
};

export function TaskChangesLink({
  slug,
  teamId,
  taskId,
}: TaskChangesLinkProps) {
  const { data } = useTaskChangeStack(teamId, taskId);
  const latest = data?.latest;

  if (!latest) {
    return null;
  }

  return (
    <ChangesRow
      to={taskChangesPath(slug, teamId, taskId, latest.repository)}
      generating={latest.state === 'generating'}
      added={latest.added}
      removed={latest.removed}
    />
  );
}
