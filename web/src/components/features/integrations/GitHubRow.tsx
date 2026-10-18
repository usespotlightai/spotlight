import { useLocation } from 'react-router';
import { GitHubAppLink } from '@/components/features/integrations/GitHubAppLink';
import { GitHubDetails } from '@/components/features/integrations/GitHubDetails';
import { IntegrationRowFrame } from '@/components/features/integrations/IntegrationRowFrame';
import GithubLogo from '@/components/shared/icons/GithubLogo';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import { useLines } from '@/hooks/api/useLines';
import { useRepositories } from '@/hooks/api/useRepositories';
import { formatRepos, inaccessibleOf, installUrlFor } from '@/lib/github';

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
  const repositories = useRepositories(connected ? slug : undefined);
  const lines = useLines(teamId);
  const accessible = (repositories.data ?? []).map((each) => each.fullName);
  const used = [
    ...new Set((lines.data ?? []).flatMap((line) => line.repositories)),
  ].sort();
  const inaccessible =
    connected && repositories.data
      ? inaccessibleOf(used, accessible)
      : new Set();
  const href = installUrl
    ? installUrlFor(installUrl, {
        slug,
        teamId,
        from: `${here.pathname}${here.search}`,
      })
    : null;

  return (
    <IntegrationRowFrame
      slot="github"
      logo={
        <GithubLogo className="size-5 shrink-0 text-foreground" aria-hidden />
      }
      name="GitHub"
      mark={
        inaccessible.size > 0 && (
          <WarningTooltip
            tone="destructive"
            label="Repositories not accessible"
            tooltip={`The App can’t access ${[...inaccessible].join(', ')}.`}
          />
        )
      }
      summary={
        !connected
          ? 'Not installed on this team’s repositories'
          : repositories.data
            ? `Can access ${formatRepos(accessible.length)}`
            : 'Works in this team’s repositories'
      }
      need={
        !connected && href && <GitHubAppLink href={href} installed={false} />
      }
    >
      <GitHubDetails
        installed={connected}
        href={href}
        accessible={accessible}
        used={used}
      />
    </IntegrationRowFrame>
  );
}
