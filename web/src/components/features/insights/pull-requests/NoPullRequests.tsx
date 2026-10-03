import { GitPullRequest } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button';
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
            className={cn(buttonVariants({ size: 'sm' }), 'rounded-full')}
          >
            Connect a repository
          </TrailLink>
        }
      >
        Once the GitHub App is installed on the team’s repositories, every pull
        request opened or merged there shows here, Spotlight’s, people’s and
        bots’.
      </EmptyState>
    </div>
  );
}
