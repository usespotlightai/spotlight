import { useLocation } from 'react-router';
import { GitHubAppLink } from '@/components/features/integrations/GitHubAppLink';
import { GitHubDetails } from '@/components/features/integrations/GitHubDetails';
import { IntegrationRowFrame } from '@/components/features/integrations/IntegrationRowFrame';
import GithubMark from '@/components/shared/icons/GithubMark';
import { NotedWarning } from '@/components/shared/NotedWarning';
import { useLines } from '@/hooks/api/useLines';
import { useRepositories } from '@/hooks/api/useRepositories';
import { installUrlFor, reposShown, unreachedOf } from '@/lib/github';

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
  const reached = (repositories.data ?? []).map((each) => each.fullName);
  const used = [
    ...new Set((lines.data ?? []).flatMap((line) => line.repositories)),
  ].sort();
  const unreached =
    connected && repositories.data ? unreachedOf(used, reached) : new Set();
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
        <GithubMark className="size-5 shrink-0 text-foreground" aria-hidden />
      }
      name="GitHub"
      mark={
        unreached.size > 0 && (
          <NotedWarning
            tone="destructive"
            label="Repositories not reached"
            note={`The App can’t reach ${[...unreached].join(', ')}.`}
          />
        )
      }
      summary={
        !connected
          ? 'Not installed on this team’s repositories'
          : repositories.data
            ? `Reaches ${reposShown(reached.length)}`
            : 'Works in this team’s repositories'
      }
      need={
        !connected && href && <GitHubAppLink href={href} installed={false} />
      }
    >
      <GitHubDetails
        installed={connected}
        href={href}
        reached={reached}
        used={used}
      />
    </IntegrationRowFrame>
  );
}
