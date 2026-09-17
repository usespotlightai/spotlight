import { CircleDashed, Layers } from 'lucide-react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button';
import { useRunChangeStacks } from '@/hooks/api/useRunChangeStacks';
import { changeStackPath, drafting } from '@/lib/change-stack';
import { cn } from '@/lib/utils';

type RunChangeStackLinkProps = {
  slug: string;
  teamId: string;
  runId: string;
};

export function RunChangeStackLink({
  slug,
  teamId,
  runId,
}: RunChangeStackLinkProps) {
  const { data } = useRunChangeStacks(teamId, runId);

  if (!data || data.stacks.length === 0) {
    return null;
  }

  const Icon = drafting(data.stacks) ? CircleDashed : Layers;

  return (
    <TrailLink
      to={changeStackPath(slug, teamId, runId)}
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
