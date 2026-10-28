import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StationImprovement } from '@/components/features/stations/overview/StationImprovement';
import type { StationImprovement as Improvement } from '@/lib/station-improvement';

const improvement = vi.fn((): Improvement | undefined => undefined);
const failing = vi.fn(() => false);
const refetch = vi.fn();

vi.mock('@/hooks/api/useStationImprovement', () => ({
  useStationImprovement: () => ({
    data: improvement(),
    isPending: improvement() === undefined && !failing(),
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

const STATION = '/w/acme/team/team_1/lines/line_1/stations/station_1';

const PULL_REQUEST = 'https://github.com/acme/platform/pull/7';

const WAITING: Improvement = {
  status: 'waiting',
  searchId: null,
  pickPhase: null,
  pullRequestUrl: null,
  improvedAt: null,
  skip: null,
  pullRequestFailure: null,
  minimumTasks: 5,
  setId: 'set_1',
  lastStartedAt: '2026-10-20T09:00:00.000Z',
  checkAfter: '2999-10-30T09:00:00.000Z',
};

const shown = (over: Partial<Improvement>) => {
  improvement.mockReturnValue({ ...WAITING, ...over });

  return render(
    <MemoryRouter>
      <StationImprovement at={AT} />
    </MemoryRouter>,
  );
};

const detail = async () => {
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Improvement detail' }));

  return screen.findByRole('dialog');
};

const statusOf = () =>
  document
    .querySelector('[data-slot="station-improvement"]')
    ?.getAttribute('data-status');

beforeEach(() => {
  improvement.mockReturnValue(undefined);
  failing.mockReturnValue(false);
  refetch.mockClear();
});

describe('StationImprovement', () => {
  it('keeps its place while the status loads', () => {
    render(
      <MemoryRouter>
        <StationImprovement at={AT} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('status', { name: 'Loading the improvement status' }),
    ).toBeInTheDocument();
  });

  it('says the status is unavailable when it could not be loaded, and tries again on request', async () => {
    failing.mockReturnValue(true);

    render(
      <MemoryRouter>
        <StationImprovement at={AT} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Status unavailable');

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('links a running search to its page, with the replay set in the detail', async () => {
    shown({ status: 'searching', searchId: 'search_3' });

    expect(statusOf()).toBe('searching');
    expect(screen.getByRole('link', { name: 'Searching' })).toHaveAttribute(
      'href',
      `${STATION}/searches/search_3`,
    );

    await detail();

    expect(screen.getByRole('link', { name: 'Replay set' })).toHaveAttribute(
      'href',
      `${STATION}/replay-sets/set_1`,
    );
  });

  it('links the search whose config Spotlight still picks, or whose pull request it opens', async () => {
    const { unmount } = shown({
      status: 'picking',
      searchId: 'search_3',
      pickPhase: 'choosing',
    });

    expect(
      screen.getByRole('link', { name: 'Choosing a config' }),
    ).toHaveAttribute('href', `${STATION}/searches/search_3`);
    expect(await detail()).toHaveTextContent(
      'The last search finished. Spotlight picks its best config.',
    );
    unmount();

    shown({ status: 'picking', searchId: 'search_3', pickPhase: 'opening' });

    expect(
      screen.getByRole('link', { name: 'Opening a pull request' }),
    ).toHaveAttribute('href', `${STATION}/searches/search_3`);
  });

  it('links an open config pull request on GitHub', async () => {
    shown({ status: 'pull-request-open', pullRequestUrl: PULL_REQUEST });

    expect(
      screen.getByRole('link', { name: 'Pull request open' }),
    ).toHaveAttribute('href', PULL_REQUEST);
    expect(await detail()).toHaveTextContent(
      'Spotlight opened a config pull request. Please review it on GitHub.',
    );
  });

  it('says Spotlight opens a pull request, with no link before GitHub has one', () => {
    shown({ status: 'pull-request-open', pullRequestUrl: null });

    expect(screen.getByText('Opening a pull request')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Opening a pull request' }),
    ).not.toBeInTheDocument();
  });

  it('links the merged pull request that improved the station', async () => {
    shown({
      status: 'improved',
      pullRequestUrl: PULL_REQUEST,
      improvedAt: '2026-10-21T09:00:00.000Z',
    });

    expect(screen.getByRole('link', { name: 'Improved' })).toHaveAttribute(
      'href',
      PULL_REQUEST,
    );
    expect(await detail()).toHaveTextContent(
      'A merged config pull request improved the station.',
    );
  });

  it('says why Spotlight cannot search the station until a person acts, with the reason on hover', async () => {
    shown({
      status: 'not-improving',
      skip: { reason: 'no-scoring', at: '2026-10-20T09:00:00.000Z' },
    });

    expect(screen.getByRole('link', { name: 'Not improving' })).toHaveAttribute(
      'href',
      `${STATION}/replay-sets/set_1`,
    );
    expect(await detail()).toHaveTextContent(
      'Spotlight did not start a search: the station has no judge and no check.',
    );
  });

  it('says why the config pull request could not be opened', async () => {
    shown({
      status: 'not-improving',
      pullRequestFailure: {
        code: 'base-changed',
        message: 'The file changed since the search began.',
        attribute: null,
        expression: null,
        wanted: null,
      },
    });

    const shownDetail = await detail();

    expect(shownDetail).toHaveTextContent(
      'Spotlight could not open the config pull request of the station.',
    );
    expect(shownDetail).toHaveTextContent(
      'ReasonThe file changed since the search began.',
    );
  });

  it('says when Spotlight looks at the station next, with its searches one hover away and no second link to the set', async () => {
    shown({});

    expect(
      screen.getByRole('link', { name: 'Waiting for next check' }),
    ).toHaveAttribute('href', `${STATION}/replay-sets/set_1`);

    const shownDetail = await detail();

    expect(shownDetail).toHaveTextContent('Next check');
    expect(shownDetail).toHaveTextContent('Last search');
    expect(
      screen.queryByRole('link', { name: 'Replay set' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Searches' })).toHaveAttribute(
      'href',
      `${STATION}/replay-sets/set_1#searches`,
    );
  });

  it('says the next check is due once its time has passed', async () => {
    shown({ checkAfter: '2026-01-01T09:00:00.000Z' });

    expect(await detail()).toHaveTextContent('Next checkdue');
  });

  it('says Spotlight does not search the station while its policy is off', async () => {
    shown({ status: 'off', setId: null, checkAfter: null });

    expect(screen.getByText('Not searching')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    const shownDetail = await detail();

    expect(shownDetail).toHaveTextContent(
      'The search policy of the station is off.',
    );
    expect(shownDetail).not.toHaveTextContent('Next check');
  });

  it('says the station has no runs to search yet', async () => {
    shown({ status: 'not-started', setId: null, checkAfter: null });

    expect(screen.getByText('No runs yet')).toBeInTheDocument();
    expect(await detail()).toHaveTextContent(
      'Spotlight keeps a replay set from the runs of the station.',
    );
    expect(
      screen.queryByRole('link', { name: 'Replay set' }),
    ).not.toBeInTheDocument();
  });
});
