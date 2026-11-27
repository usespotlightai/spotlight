import { FlaskConical } from 'lucide-react';
import type { ReactElement } from 'react';

import { EmptyFrame } from '@/components/shared/EmptyFrame';
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

export function NoCandidates({
  slug,
  teamId,
  lineId,
}: NoCandidatesProps): ReactElement {
  return (
    <EmptyFrame>
      <EmptyState
        icon={FlaskConical}
        title="No candidates replayed in this period"
        action={
          <TrailLink
            to={
              lineId !== null && lineId !== ''
                ? linePath(slug, teamId, lineId)
                : teamPath(slug, teamId)
            }
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'rounded-full bg-card shadow-none',
            )}
          >
            {lineId !== null && lineId !== ''
              ? 'Open the line'
              : 'Open the team’s lines'}
          </TrailLink>
        }
      >
        Spotlight replays the candidates of each automatic search here.
      </EmptyState>
    </EmptyFrame>
  );
}
