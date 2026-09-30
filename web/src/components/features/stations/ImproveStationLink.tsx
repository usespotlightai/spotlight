import { MousePointer2 } from 'lucide-react';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button';
import type { ImprovedStation } from '@/lib/chat';
import { teamSectionPath } from '@/lib/team';
import { cn } from '@/lib/utils';

type ImproveStationLinkProps = {
  slug: string;
  teamId: string;
  improving: ImprovedStation;
  className?: string;
};

export function ImproveStationLink({
  slug,
  teamId,
  improving,
  className,
}: ImproveStationLinkProps) {
  return (
    <TrailLink
      to={teamSectionPath(slug, teamId, 'agent')}
      state={{ improving }}
      className={cn(
        buttonVariants({ variant: 'outline', size: 'sm' }),
        'rounded-full bg-card shadow-none',
        className,
      )}
    >
      <MousePointer2 aria-hidden />
      Improve this station
    </TrailLink>
  );
}
