import { useLocation } from 'react-router';
import GithubMark from '@/components/shared/icons/GithubMark';
import { installUrlFor } from '@/lib/github';
import { pillClass } from '@/lib/pill';

type GitHubRowProps = {
  slug: string;
  teamId: string;
  installUrl: string | null;
  connected: boolean;
};

export function GitHubRow({
  slug,
  teamId,
  installUrl,
  connected,
}: GitHubRowProps) {
  const here = useLocation();
  const onGitHub = installUrl
    ? installUrlFor(installUrl, {
        slug,
        teamId,
        from: `${here.pathname}${here.search}`,
      })
    : null;

  return (
    <li
      data-slot="github"
      className="flex min-h-12 items-center justify-between gap-4 px-4 py-2"
    >
      <div className="flex min-w-0 items-center gap-3">
        <GithubMark className="size-5 shrink-0 text-foreground" aria-hidden />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-foreground text-sm">GitHub</span>
          <span className="text-muted-foreground text-xs">
            {connected
              ? 'Works in this team’s repositories'
              : 'Not installed on this team’s repositories'}
          </span>
        </div>
      </div>

      {onGitHub ? (
        <a
          href={onGitHub}
          className={pillClass(connected ? 'outline' : 'default', 'mr-7')}
        >
          {connected ? 'Manage on GitHub' : 'Install on GitHub'}
        </a>
      ) : (
        !connected && (
          <span className="mr-7 text-muted-foreground text-xs">
            Install link unavailable
          </span>
        )
      )}
    </li>
  );
}
