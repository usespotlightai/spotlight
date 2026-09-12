import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamRuns } from '@/components/features/runs/TeamRuns';
import type { TeamRun } from '@/lib/run';

const runs = vi.fn();

vi.mock('@/hooks/api/useTeamRuns', () => ({
  useTeamRuns: () => ({ data: runs(), isPending: false }),
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
});

describe('TeamRuns', () => {
  it('shows every run under All by default', () => {
    showing();

    expect(filter('All')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Fix the login bug')).toBeInTheDocument();
    expect(screen.getByText('Tidy the settings page')).toBeInTheDocument();
    expect(screen.getByText('Upgrade the harness')).toBeInTheDocument();
  });

  it('narrows to runs still owed a review under Awaiting Review', async () => {
    showing();

    await userEvent.click(filter('Awaiting Review'));

    expect(filter('Awaiting Review')).toHaveAttribute('aria-current', 'page');
    expect(filter('All')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Fix the login bug')).toBeInTheDocument();
    expect(
      screen.queryByText('Tidy the settings page'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Upgrade the harness')).not.toBeInTheDocument();
  });

  it('says so when nothing is awaiting review', async () => {
    runs.mockReturnValue([settled, unreviewed]);
    showing();

    await userEvent.click(filter('Awaiting Review'));

    expect(screen.getByText('Nothing is awaiting review.')).toBeInTheDocument();
    expect(filter('All')).toBeInTheDocument();
  });

  it('comes back on the filter it was left on', async () => {
    const { unmount } = showing();

    await userEvent.click(filter('Awaiting Review'));
    unmount();
    showing();

    expect(filter('Awaiting Review')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Upgrade the harness')).not.toBeInTheDocument();
  });

  it('offers no filters before anything has been run', () => {
    runs.mockReturnValue([]);
    showing();

    expect(
      screen.getByText('Nothing has been run for this team yet.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'All' }),
    ).not.toBeInTheDocument();
  });
});
