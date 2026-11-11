import { Spool } from 'lucide-react';

import { EmptyFrame } from '@/components/shared/EmptyFrame';
import { EmptyState } from '@/components/shared/EmptyState';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';
import { teamSectionPath } from '@/lib/team';
import { cn } from '@/lib/utils';

export function NoMemories({ slug, teamId }: { slug: string; teamId: string }) {
  return (
    <EmptyFrame>
      <EmptyState
        icon={Spool}
        title="No memories yet"
        action={
          <TrailLink
            to={teamSectionPath(slug, teamId, 'memory')}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'rounded-full bg-card shadow-none',
            )}
          >
            Open the team’s memory
          </TrailLink>
        }
      >
        Memory use and run outcomes show here once the team has memories.
      </EmptyState>
    </EmptyFrame>
  );
}
