import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ReplaySetHeading } from '@/components/features/replays/set/ReplaySetHeading';
import type { ReplaySet } from '@/lib/replay';

const SET: ReplaySet = {
  id: 'set_1',
  lineId: 'line_1',
  stationId: 'station_1',
  createdAt: '2026-10-01T09:00:00.000Z',
  refreshedAt: null,
  lastRefresh: null,
  stationGone: false,
  health: {
    noise: null,
    saturation: null,
    judge: null,
    checks: null,
    oracle: null,
  },
  minGain: 0.05,
  composition: {
    outcomes: [
      { outcome: 'accepted', count: 0 },
      { outcome: 'sent-back', count: 0 },
      { outcome: 'asked', count: 0 },
      { outcome: 'failed', count: 0 },
      { outcome: 'other', count: 0 },
    ],
    origins: [],
    oldest: null,
    median: null,
    newest: null,
    balanceWarning: null,
  },
  entries: [],
};

const renderHeading = (set: ReplaySet) =>
  render(
    <MemoryRouter>
      <ReplaySetHeading set={set} line={undefined} station={undefined} />
    </MemoryRouter>,
  );

describe('ReplaySetHeading', () => {
  it('names the set, its runs and that Spotlight keeps it', () => {
    renderHeading(SET);

    expect(
      screen.getByRole('heading', { name: 'Replay set' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Kept by Spotlight, not refreshed yet'),
    ).toBeInTheDocument();
  });

  it('counts what the last refresh added and took out, naming the first 3 of each, in its description', () => {
    renderHeading({
      ...SET,
      refreshedAt: new Date().toISOString(),
      lastRefresh: {
        at: new Date().toISOString(),
        added: [
          { runId: 'run_1', title: 'Drain the queue' },
          { runId: 'run_2', title: 'Fix the retries' },
          { runId: 'run_3', title: 'Split the invoice' },
          { runId: 'run_4', title: 'Cache the prices' },
        ],
        removed: [{ runId: 'run_0', title: null }],
      },
    });

    const refresh = screen.getByText(/^Kept by Spotlight, refreshed /);
    expect(refresh).toHaveAccessibleDescription(
      expect.stringContaining(
        'Added: 4: Drain the queue, Fix the retries, Split the invoice and 1 more. Taken out: 1: A deleted task.',
      ),
    );
  });

  it('marks a set whose station is gone', () => {
    renderHeading({ ...SET, stationGone: true });

    expect(screen.getByText('Station gone')).toBeInTheDocument();
  });
});
