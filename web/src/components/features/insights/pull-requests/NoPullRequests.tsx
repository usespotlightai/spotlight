import { GitPullRequest } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';
import { teamSettingsPath } from '@/lib/settings';
import { cn } from '@/lib/utils';

type NoPullRequestsProps = {
  slug: string;
  teamId: string;
};

export function NoPullRequests({ slug, teamId }: NoPullRequestsProps) {
  return (
    <div className="flex justify-center rounded-xl border border-border px-4 py-10">
      <EmptyState
        icon={GitPullRequest}
        title="No pull requests in this period"
        action={
          <TrailLink
            to={teamSettingsPath(slug, teamId, 'integrations')}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'rounded-full bg-card shadow-none',
            )}
          >
            Connect a repository
          </TrailLink>
        }
      >
        Pull requests by Spotlight, people and bots show here. Please install
        the GitHub App on the team’s repositories.
      </EmptyState>
    </div>
  );
}
