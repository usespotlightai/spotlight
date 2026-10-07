import { useLocation } from 'react-router';
import GithubMark from '@/components/shared/icons/GithubMark';
import { buttonVariants } from '@/components/ui/button-variants';
import { installUrlFor } from '@/lib/github';
import { cn } from '@/lib/utils';

type GitHubIntegrationProps = {
  slug: string | undefined;
  teamId: string;
  installUrl: string | null;
  connected: boolean;
};

export function GitHubIntegration({
  slug,
  teamId,
  installUrl,
  connected,
}: GitHubIntegrationProps) {
  const here = useLocation();

  const onGitHub =
    slug && installUrl
      ? installUrlFor(installUrl, {
          slug,
          teamId,
          from: `${here.pathname}${here.search}`,
        })
      : null;

  const summary = connected
    ? 'Works in this team’s repositories.'
    : 'Not installed. Install the App to work in this team’s repositories.';

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-start gap-2.5">
          <GithubMark
            className="mt-px size-5 shrink-0 text-foreground"
            aria-hidden
          />

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h3 className="font-medium text-foreground text-sm">GitHub</h3>
            <p className="text-muted-foreground text-xs leading-5">{summary}</p>
          </div>
        </div>

        <div className="mt-auto flex h-7 items-center justify-end">
          {onGitHub ? (
            <a
              href={onGitHub}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'rounded-full bg-card shadow-none',
              )}
            >
              {connected ? 'Manage on GitHub' : 'Install it on GitHub'}
            </a>
          ) : (
            !connected && (
              <span className="text-muted-foreground text-xs">
                GitHub install link unavailable
              </span>
            )
          )}
        </div>
      </div>
    </article>
  );
}
