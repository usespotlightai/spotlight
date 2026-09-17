import { CircleDashed, Layers } from 'lucide-react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button';
import { useTaskChangeStack } from '@/hooks/api/useTaskChangeStack';
import { changeStackPath } from '@/lib/change-stack';
import { cn } from '@/lib/utils';

type TaskChangeStackLinkProps = {
  slug: string;
  teamId: string;
  taskId: string;
};

export function TaskChangeStackLink({
  slug,
  teamId,
  taskId,
}: TaskChangeStackLinkProps) {
  const { data } = useTaskChangeStack(teamId, taskId);
  const latest = data?.latest;

  if (!latest) {
    return null;
  }

  const Icon = latest.state === 'drafting' ? CircleDashed : Layers;
  const at = changeStackPath(slug, teamId, latest.runId);

  return (
    <TrailLink
      to={
        latest.repository
          ? `${at}?repository=${encodeURIComponent(latest.repository)}`
          : at
      }
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'rounded-full bg-card shadow-none',
      )}
    >
      <Icon aria-hidden />
      Change stack
    </TrailLink>
  );
}
