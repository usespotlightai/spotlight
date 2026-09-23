import type { QueryClient } from '@tanstack/react-query';
import { gitHubKeys } from '@/hooks/api/useGitHub';
import type { GitHubStandingResponseDto } from '@/lib/api';
import { failQuery } from '@/stories/failQuery';
import { SLUG } from '@/stories/fixtures/team';

export const seedGitHub =
  (connected: boolean) =>
  (client: QueryClient): void => {
    client.setQueryData(gitHubKeys.standing(SLUG), {
      connected,
      installUrl: 'https://github.com/apps/spotlight/installations/new',
    } satisfies GitHubStandingResponseDto);
  };

export const failGitHub = (client: QueryClient): void =>
  failQuery(client, gitHubKeys.standing(SLUG));
