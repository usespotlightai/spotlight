import { ChangesRow } from '@/components/features/changes/ChangesRow';
import { useTaskChangeStack } from '@/hooks/api/useTaskChangeStack';
import { changeStackPath } from '@/lib/change-stack';

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

  const at = changeStackPath(slug, teamId, latest.runId);

  return (
    <ChangesRow
      to={
        latest.repository
          ? `${at}?repository=${encodeURIComponent(latest.repository)}`
          : at
      }
      generating={latest.state === 'generating'}
      added={latest.added}
      removed={latest.removed}
    />
  );
}
