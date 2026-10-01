import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamInsights } from '@/components/features/insights/TeamInsights';
import type { InsightsMemory } from '@/lib/insights-memory';

type Held = {
  data: unknown;
  isPending: boolean;
  isFetching: boolean;
  errorUpdateCount: number;
  refetch: () => void;
};

const held = (data: unknown, errorUpdateCount = 0): Held => ({
  data,
  isPending: data === undefined && errorUpdateCount === 0,
  isFetching: false,
  errorUpdateCount,
  refetch: vi.fn(),
});

const answer: { memory: Held } = { memory: held(undefined) };

vi.mock('@/hooks/api/useInsightsMemory', () => ({
  useInsightsMemory: () => answer.memory,
}));
vi.mock('@/hooks/api/useLines', () => ({ useLines: () => ({ data: [] }) }));

const tally = (over: Record<string, unknown> = {}) => ({
  runs: 10,
  withdrawn: 0,
  failed: 0,
  stopped: 0,
  checksPassed: 0,
  checksFailed: 0,
  accepted: 5,
  sentBack: 1,
  handedOn: 0,
  merged: 0,
  cost: null,
  unpriced: 0,
  mixedCurrencies: false,
  medianMs: null,
  p90Ms: null,
  ...over,
});

const MEMORY = {
  period: { name: '30d' },
  truncated: false,
  standing: 12,
  memoriesBriefed: 7,
  memoriesRecalled: 2,
  runsBriefed: 30,
  runsRecalled: 4,
  flagged: [
    {
      memoryId: 'memory_1',
      handle: 'M-1',
      body: 'Run the migrations first.',
      reason: 'Not any more',
      by: 'user_1',
      byName: 'Ada Lovelace',
      at: '2026-09-28T10:00:00.000Z',
    },
  ],
  withMemories: tally({ accepted: 8 }),
  withoutMemories: tally(),
  verdicts: [
    {
      measure: 'accepted_rate',
      before: 0.5,
      after: 0.8,
      settledBefore: 4,
      settledAfter: 10,
      currency: null,
      verdict: 'insufficient',
    },
  ],
  benchmark: null,
} as unknown as InsightsMemory;

const showing = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1/insights?tab=memory']}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/:section"
          element={<TeamInsights slug="acme" teamId="team_1" />}
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  answer.memory = held(MEMORY);
});

describe('the Memory tab', () => {
  it('is a tab of Insights', () => {
    showing();

    expect(screen.getByRole('link', { name: 'Memory' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/insights?tab=memory',
    );
  });

  it('shows a faithful skeleton while it loads', () => {
    answer.memory = held(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the memory' }),
    ).toBeInTheDocument();
  });

  it('offers to try again where it could not load', async () => {
    answer.memory = held(undefined, 1);

    showing();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(answer.memory.refetch).toHaveBeenCalled();
  });

  it('leads to the team’s memory where it keeps none', () => {
    answer.memory = held({
      ...MEMORY,
      standing: 0,
      memoriesBriefed: 0,
      memoriesRecalled: 0,
      flagged: [],
    });

    showing();

    expect(
      screen.getByRole('link', { name: 'Open the team’s memory' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/memory');
  });

  it('shows how memories were used, flagged, and how runs with them went against runs without', () => {
    showing();

    const tiles = screen.getByLabelText('Memory use');
    const standing = within(tiles)
      .getByText('Standing memories')
      .closest('[data-slot="insights-tile"]') as HTMLElement;
    expect(standing).toHaveTextContent('12');
    expect(within(tiles).getByText('to 30 runs')).toBeInTheDocument();

    const compared = screen.getByRole('table', {
      name: 'Runs without memories against runs with them',
    });
    expect(
      within(compared).getByRole('row', { name: /Accepted/ }),
    ).toHaveTextContent('50%80%Too few runs');

    const flagged = screen.getByRole('list', {
      name: 'Memories flagged wrong',
    });
    expect(within(flagged).getByRole('link', { name: 'M-1' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/memory?memory=memory_1',
    );
    expect(flagged).toHaveTextContent('Ada Lovelace');
    expect(screen.getByText('No benchmark yet.')).toBeInTheDocument();
  });
});
