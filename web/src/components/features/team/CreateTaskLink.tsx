import { TrailLink } from '@/components/shell/layout/TrailLink';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
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
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'rounded-full bg-card shadow-none',
      )}
    >
      {CREATE}
    </TrailLink>
  ) : (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full bg-card shadow-none"
      disabled
    >
      {CREATE}
    </Button>
  );
}
