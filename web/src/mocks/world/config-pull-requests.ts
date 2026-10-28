import type { CandidatePullRequestResponseDto } from '@/lib/api';
import { TESTS_FIRST_PULL_REQUEST } from '@/mocks/world/station-history';

export type ConfigPullRequestShown =
  | 'opened'
  | 'closing'
  | 'closed-stale'
  | 'closed-by-person'
  | 'closed-close-failure'
  | 'merged';

const followed = (
  over: Partial<CandidatePullRequestResponseDto>,
): CandidatePullRequestResponseDto => ({
  id: 'config_pull_request_58',
  state: 'opened',
  closedBecause: null,
  closeFailure: null,
  url: TESTS_FIRST_PULL_REQUEST,
  reason: null,
  ...over,
});

export const CONFIG_PULL_REQUESTS: Record<
  ConfigPullRequestShown,
  CandidatePullRequestResponseDto
> = {
  opened: followed({}),
  closing: followed({ state: 'closing', closedBecause: 'stale' }),
  'closed-stale': followed({ state: 'closed', closedBecause: 'stale' }),
  'closed-by-person': followed({ state: 'closed', closedBecause: 'by-person' }),
  'closed-close-failure': followed({
    state: 'closed',
    closedBecause: 'stale',
    closeFailure: {
      code: 'repository-unreachable',
      message:
        'Spotlight’s GitHub App cannot access acme/config. Please install it on the repository.',
      attribute: null,
      expression: null,
      wanted: null,
    },
  }),
  merged: followed({ state: 'merged' }),
};
