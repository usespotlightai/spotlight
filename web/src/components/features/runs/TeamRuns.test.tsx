import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamRuns } from '@/components/features/runs/TeamRuns';
import type { TeamRun } from '@/lib/run';

const runs = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useTeamRuns', () => ({
  useTeamRuns: () => ({
    data: runs(),
    isPending: runs() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [{ id: 'line_1', name: 'Delivery', stations: [] }],
  }),
}));

const run = (
  id: string,
  taskTitle: string,
  review: TeamRun['review'],
): TeamRun => ({
  id,
  state: 'completed',
  attempt: 1,
  exitCode: 0,
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  harness: 'claude-code',
  image: null,
  station: null,
  review,
  taskId: `task_${id}`,
  taskTitle,
  taskDescription: null,
});

const owed = run('run_1', 'Fix the login bug', {
  state: 'owed',
  conversationId: 'conv_1',
});
const settled = run('run_2', 'Tidy the settings page', {
  state: 'settled',
  conversationId: 'conv_2',
});
const unreviewed = run('run_3', 'Upgrade the harness', null);

const showing = () =>
  render(
    <MemoryRouter>
      <TeamRuns slug="acme" teamId="team_1" />
    </MemoryRouter>,
  );

const filter = (name: string) => screen.getByRole('button', { name });

beforeEach(() => {
  localStorage.clear();
  runs.mockReturnValue([owed, settled, unreviewed]);
  failing.mockReturnValue(false);
  refetch.mockClear();
});

describe('TeamRuns', () => {
  it('shows every run under All by default', () => {
    showing();

    expect(filter('All')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Fix the login bug')).toBeInTheDocument();
    expect(screen.getByText('Tidy the settings page')).toBeInTheDocument();
    expect(screen.getByText('Upgrade the harness')).toBeInTheDocument();
  });

  it('narrows to runs still owed a review under Waiting for you', async () => {
    showing();

    await userEvent.click(filter('Waiting for you'));

    expect(filter('Waiting for you')).toHaveAttribute('aria-current', 'page');
    expect(filter('All')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Fix the login bug')).toBeInTheDocument();
    expect(
      screen.queryByText('Tidy the settings page'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Upgrade the harness')).not.toBeInTheDocument();
  });

  it('says so when nothing is waiting for you', async () => {
    runs.mockReturnValue([settled, unreviewed]);
    showing();

    await userEvent.click(filter('Waiting for you'));

    expect(
      screen.getByText(
        'Nothing is waiting for you. Switch to All to see every run.',
      ),
    ).toBeInTheDocument();
    expect(filter('All')).toBeInTheDocument();
  });

  it('comes back on the filter it was left on', async () => {
    const { unmount } = showing();

    await userEvent.click(filter('Waiting for you'));
    unmount();
    showing();

    expect(filter('Waiting for you')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Upgrade the harness')).not.toBeInTheDocument();
  });

  it('holds the shape of a run while they load, with the filters already there', () => {
    runs.mockReturnValue(undefined);
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the runs' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.queryByText('No runs yet')).not.toBeInTheDocument();
  });

  it('says the runs could not be loaded, and tries again when asked', async () => {
    runs.mockReturnValue(undefined);
    failing.mockReturnValue(true);
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Runs could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'All' }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('keeps the runs it has when a later refresh fails', () => {
    failing.mockReturnValue(true);
    showing();

    expect(screen.getByText('Fix the login bug')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers no filters before anything has been run', () => {
    runs.mockReturnValue([]);
    showing();

    expect(screen.getByText('No runs yet')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'All' }),
    ).not.toBeInTheDocument();
  });

  it('sends you to the team’s first line to create a task when nothing has run', () => {
    runs.mockReturnValue([]);
    showing();

    expect(screen.getByRole('link', { name: 'Create a task' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
  });
});
