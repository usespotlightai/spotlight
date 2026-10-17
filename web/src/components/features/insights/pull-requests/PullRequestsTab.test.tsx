import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PullRequestsTab } from '@/components/features/insights/pull-requests/PullRequestsTab';
import { paramsOf, viewOf } from '@/lib/insights';
import type {
  InsightsPullRequest,
  InsightsPullRequestList,
  InsightsPullRequests,
  PullRequestFilter,
} from '@/lib/insights-pull-requests';

type Queried = {
  data: unknown;
  isPending: boolean;
  isFetching: boolean;
  errorUpdateCount: number;
  refetch: () => void;
};

const queried = (data: unknown, errorUpdateCount = 0): Queried => ({
  data,
  isPending: data === undefined && errorUpdateCount === 0,
  isFetching: false,
  errorUpdateCount,
  refetch: vi.fn(),
});

const answers: { summary: Queried; list: Queried } = {
  summary: queried(undefined),
  list: queried(undefined),
};
const listed: { filter: PullRequestFilter; page: number }[] = [];

vi.mock('@/hooks/api/useInsightsPullRequests', () => ({
  useInsightsPullRequests: () => answers.summary,
}));
vi.mock('@/hooks/api/useInsightsPullRequestList', () => ({
  useInsightsPullRequestList: (
    _teamId: string,
    _period: string,
    filter: PullRequestFilter,
    page: number,
  ) => {
    listed.push({ filter, page });
    return answers.list;
  },
}));

const spread = { p50Ms: 3_600_000, p90Ms: 7_200_000, count: 2 };

const measures = {
  merged: 2,
  toMerge: spread,
  inReview: spread,
  meanRounds: 1.5,
  meanComments: 2,
  reverted: 1,
  revertRate: 0.5,
};

const week = {
  week: '2026-09-28',
  merged: 4,
  made: 2,
  touched: 1,
  bots: 0,
  share: 0.75,
};

const SUMMARY = {
  period: { name: '30d' },
  total: 6,
  repositories: ['acme/api'],
  weeks: ['2026-09-28'],
  penetration: {
    merged: 4,
    made: 2,
    touched: 1,
    bots: 0,
    share: 0.75,
    weeks: [week],
    repositories: [
      {
        repository: 'acme/api',
        merged: 4,
        made: 2,
        touched: 1,
        bots: 0,
        share: 0.75,
        weeks: [week],
      },
    ],
  },
  comparison: {
    repositories: ['acme/api'],
    spotlight: measures,
    people: { ...measures, reverted: 0, revertRate: 0 },
  },
  types: [
    {
      type: 'fix',
      spotlight: 2,
      people: 1,
      spend: { amount: 3, currency: 'USD' },
      unpriced: 0,
      mixedCurrencies: false,
    },
  ],
  depth: [{ rounds: '1', spotlight: 2, people: 1 }],
} as unknown as InsightsPullRequests;

const pullRequest = (over: Partial<InsightsPullRequest>): InsightsPullRequest =>
  ({
    pullRequest: 'https://github.com/acme/api/pull/7',
    repository: 'acme/api',
    number: 7,
    title: 'Retry failed uploads',
    author: 'spotlight[bot]',
    authorIsBot: true,
    by: 'spotlight',
    taskId: 'task_7',
    reviewTaskIds: [],
    type: 'fix',
    state: 'merged',
    openedAt: '2026-09-29T08:00:00.000Z',
    closedAt: '2026-09-29T12:00:00.000Z',
    firstReviewAt: null,
    toMergeMs: 4 * 3_600_000,
    inReviewMs: null,
    reviews: 0,
    reviewRounds: 1,
    reviewComments: 2,
    isRevert: false,
    reverted: false,
    revertedBy: null,
    additions: 10,
    deletions: 2,
    changedFiles: 1,
    spend: { amount: 1.5, currency: 'USD' },
    unpriced: 0,
    ...over,
  }) as InsightsPullRequest;

const LIST = {
  period: { name: '30d' },
  total: 2,
  page: 1,
  size: 50,
  pullRequests: [
    pullRequest({}),
    pullRequest({
      pullRequest: 'https://github.com/acme/api/pull/8',
      number: 8,
      title: 'Move billing',
      author: 'ada',
      by: 'touched',
      taskId: null,
      reviewTaskIds: ['task_review_8'],
      spend: null,
    }),
  ],
} as unknown as InsightsPullRequestList;

function Productivity() {
  const [params, setParams] = useSearchParams();

  return (
    <PullRequestsTab
      slug="acme"
      teamId="team_1"
      view={viewOf(params)}
      onView={(next) => setParams(paramsOf(next), { replace: true })}
    />
  );
}

function Address() {
  const location = useLocation();
  return <output aria-label="Address">{location.search}</output>;
}

const showing = (search = '?tab=productivity') =>
  render(
    <MemoryRouter initialEntries={[`/w/acme/team/team_1/insights${search}`]}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/insights"
          element={
            <>
              <Productivity />
              <Address />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

const address = () => screen.getByRole('status', { name: 'Address' });

const PRODUCTIVITY = '/w/acme/team/team_1/insights?tab=productivity';

beforeEach(() => {
  listed.length = 0;
  answers.summary = queried(SUMMARY);
  answers.list = queried(LIST);
});

describe('the pull requests of the Productivity tab', () => {
  it('shows a faithful skeleton while it loads', () => {
    answers.summary = queried(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the pull requests' }),
    ).toBeInTheDocument();
  });

  it('offers to try again where it could not load', async () => {
    answers.summary = queried(undefined, 1);

    showing();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(answers.summary.refetch).toHaveBeenCalled();
  });

  it('leads to connecting a repository where no pull request was recorded', () => {
    answers.summary = queried({ ...SUMMARY, total: 0 });

    showing();

    expect(
      screen.getByRole('link', { name: 'Connect a repository' }),
    ).toHaveAttribute('href', '/w/acme/settings/team/team_1/integrations');
  });

  it('shows the pull requests still open where nothing merged yet', () => {
    answers.summary = queried({
      ...SUMMARY,
      penetration: { ...SUMMARY.penetration, merged: 0 },
    });

    showing();

    expect(
      screen.queryByRole('link', { name: 'Connect a repository' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Pull requests' }),
    ).toBeInTheDocument();
  });

  it('opens the pull requests behind each number', () => {
    showing('?tab=productivity&period=7d');

    const tiles = screen.getByLabelText('Merged pull requests');

    expect(
      within(
        within(tiles)
          .getByText('Made by Spotlight')
          .closest('[data-slot="insights-tile"]') as HTMLElement,
      ).getByRole('link', { name: '2' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=productivity&period=7d&author=spotlight&state=merged',
    );

    const against = screen.getByRole('table', {
      name: 'Spotlight’s pull requests compared with people’s',
    });

    expect(
      within(against).getAllByRole('link', { name: '50% · 1' })[0],
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=productivity&period=7d&author=spotlight&state=merged&reverted=true',
    );
  });

  it('opens the merged pull requests of each repository’s week, and of each type', async () => {
    showing();

    const repositories = screen.getByRole('table', {
      name: 'Spotlight’s share by repository and week',
    });

    expect(
      within(repositories).getByRole('link', { name: '75%' }),
    ).toHaveAttribute(
      'href',
      `${PRODUCTIVITY}&repository=acme%2Fapi&state=merged&week=2026-09-28`,
    );
    expect(
      within(repositories).getByRole('link', { name: '4' }),
    ).toHaveAttribute(
      'href',
      `${PRODUCTIVITY}&repository=acme%2Fapi&state=merged`,
    );

    await userEvent.click(
      within(
        screen.getByRole('region', { name: 'What Spotlight ships' }),
      ).getByRole('button', { name: 'Table' }),
    );

    const types = screen.getByRole('table', {
      name: 'Merged pull requests by type',
    });

    expect(within(types).getByRole('link', { name: '2' })).toHaveAttribute(
      'href',
      `${PRODUCTIVITY}&author=spotlight&type=fix&state=merged`,
    );
  });

  it('links each pull request to GitHub, and Spotlight’s to its task and runs', () => {
    showing();

    const table = screen.getByRole('table', { name: 'Pull requests' });

    expect(
      within(table).getByRole('link', { name: /Retry failed uploads/ }),
    ).toHaveAttribute('href', 'https://github.com/acme/api/pull/7');
    expect(
      within(table).getByRole('link', { name: 'Spotlight' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/tasks/task_7');
    expect(within(table).getByRole('link', { name: 'Runs' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=runs&taskId=task_7',
    );
    expect(
      within(table).getByRole('link', { name: 'Spotlight review' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/tasks/task_review_8');
  });

  it('reads its filters from the address, and keeps them there', async () => {
    showing('?tab=productivity&author=people&week=2026-09-28&page=2');

    expect(listed.at(-1)).toEqual({
      filter: { author: 'people', week: '2026-09-28' },
      page: 2,
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'Stop narrowing by week of' }),
    );

    expect(address()).toHaveTextContent('?tab=productivity&author=people');
  });

  it('says nothing matches, and offers every pull request', async () => {
    answers.list = queried({ ...LIST, total: 0, pullRequests: [] });

    showing('?tab=productivity&type=tests');

    expect(screen.getByText('No pull requests match.')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Show every pull request' }),
    );

    expect(address()).toHaveTextContent('?tab=productivity');
    expect(address()).not.toHaveTextContent('type');
  });

  it('shows a skeleton for the list while only the list loads', () => {
    answers.list = queried(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the pull request list' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Merged pull requests')).toBeInTheDocument();
  });

  it('offers to try the list again where only the list could not load', async () => {
    answers.list = queried(undefined, 1);

    showing();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(answers.list.refetch).toHaveBeenCalled();
    expect(answers.summary.refetch).not.toHaveBeenCalled();
  });

  it('says no pull request is listed for the period where nothing narrows it', () => {
    answers.list = queried({ ...LIST, total: 0, pullRequests: [] });

    showing();

    expect(
      screen.getByText('No pull requests in this period.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Show every pull request' }),
    ).toBeNull();
  });

  it('pages through the pull requests, keeping the page in the address', async () => {
    answers.list = queried({ ...LIST, total: 120 });

    showing();

    const pages = screen.getByRole('navigation', {
      name: 'Pages of pull requests',
    });

    expect(within(pages).getByText('1–50 of 120')).toBeInTheDocument();
    expect(
      within(pages).getByRole('button', { name: 'Previous page' }),
    ).toBeDisabled();

    await userEvent.click(
      within(pages).getByRole('button', { name: 'Next page' }),
    );

    expect(address()).toHaveTextContent('?tab=productivity&page=2');
    expect(listed.at(-1)).toEqual({ filter: {}, page: 2 });
  });
});
