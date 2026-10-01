import { Wrench } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button';
import { settingsPath } from '@/lib/team';
import { cn } from '@/lib/utils';

type NoToolsUsedProps = {
  slug: string;
  teamId: string;
};

export function NoToolsUsed({ slug, teamId }: NoToolsUsedProps) {
  return (
    <div className="flex justify-center rounded-xl border border-border px-4 py-10">
      <EmptyState
        icon={Wrench}
        title="No skills or MCP servers used in this period"
        action={
          <TrailLink
            to={settingsPath(slug, teamId, 'skills')}
            className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}
          >
            See the team’s skills
          </TrailLink>
        }
      >
        Once a station gives its runs skills or MCP servers, which ones they
        read and call, and how the servers behave, shows here.
      </EmptyState>
    </div>
  );
}
