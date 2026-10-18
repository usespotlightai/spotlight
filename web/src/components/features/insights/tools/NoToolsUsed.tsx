import { Wrench } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';
import { teamSettingsPath } from '@/lib/settings';
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
            to={teamSettingsPath(slug, teamId, 'skills')}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'rounded-full bg-card shadow-none',
            )}
          >
            See the team’s skills
          </TrailLink>
        }
      >
        Skill reads and MCP server calls show here once a station enables skills
        or MCP servers for its runs.
      </EmptyState>
    </div>
  );
}
