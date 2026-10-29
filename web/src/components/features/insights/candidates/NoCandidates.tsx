import { FlaskConical } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';
import { linePath, teamPath } from '@/lib/team';
import { cn } from '@/lib/utils';

type NoCandidatesProps = {
  slug: string;
  teamId: string;
  lineId: string | null;
};

export function NoCandidates({ slug, teamId, lineId }: NoCandidatesProps) {
  return (
    <div className="flex justify-center rounded-xl border border-border px-4 py-10">
      <EmptyState
        icon={FlaskConical}
        title="No candidates replayed in this period"
        action={
          <TrailLink
            to={
              lineId ? linePath(slug, teamId, lineId) : teamPath(slug, teamId)
            }
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'rounded-full bg-card shadow-none',
            )}
          >
            {lineId ? 'Open the line' : 'Open the team’s lines'}
          </TrailLink>
        }
      >
        Spotlight replays the candidates of each automatic search here.
      </EmptyState>
    </div>
  );
}
