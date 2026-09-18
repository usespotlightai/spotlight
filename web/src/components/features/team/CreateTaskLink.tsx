import { TrailLink } from '@/components/shell/layout/TrailLink';
import { Button, buttonVariants } from '@/components/ui/button';
import { useLines } from '@/hooks/api/useLines';
import { linePath } from '@/lib/team';
import { cn } from '@/lib/utils';

const CREATE = 'Create a task';

export function CreateTaskLink({
  slug,
  teamId,
}: {
  slug: string;
  teamId: string | undefined;
}) {
  const { data: lines } = useLines(teamId);
  const line = lines?.[0];

  return teamId && line ? (
    <TrailLink
      to={linePath(slug, teamId, line.id)}
      className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}
    >
      {CREATE}
    </TrailLink>
  ) : (
    <Button type="button" size="sm" className="rounded-full" disabled>
      {CREATE}
    </Button>
  );
}
