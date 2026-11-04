import { GitPullRequest } from 'lucide-react';
import { EmptyFrame } from '@/components/shared/EmptyFrame';
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
    <EmptyFrame>
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
    </EmptyFrame>
  );
}
