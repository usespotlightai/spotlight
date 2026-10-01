import { Brain } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button';
import { teamSectionPath } from '@/lib/team';
import { cn } from '@/lib/utils';

export function NoMemories({ slug, teamId }: { slug: string; teamId: string }) {
  return (
    <div className="flex justify-center rounded-xl border border-border px-4 py-10">
      <EmptyState
        icon={Brain}
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
        Once the team keeps memories, how often runs are briefed them and how
        those runs turn out show here.
      </EmptyState>
    </div>
  );
}
