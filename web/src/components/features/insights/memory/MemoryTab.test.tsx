import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryTab } from '@/components/features/insights/memory/MemoryTab';
import type {
  InsightsPeriodResponseDto,
  MeasureVerdictResponseDto,
  RunTallyResponseDto,
} from '@/lib/api';
import type { InsightsMemory } from '@/lib/insights-memory';
import { htmlElement } from '@/test/elements';
import { partial } from '@/test/partial';

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

const answer: { memory: Queried; requested: unknown[] } = {
  memory: queried(undefined),
  requested: [],
};

vi.mock('@/hooks/api/useInsightsMemory', () => ({
  useInsightsMemory: (teamId: string, period: string) => {
    answer.requested.push({ teamId, period });
    return answer.memory;
  },
}));

const tally = (over: Partial<RunTallyResponseDto> = {}): RunTallyResponseDto =>
  partial<RunTallyResponseDto>({
    runs: 10,
    cancelled: 0,
    failed: 0,
    stopped: 0,
    checksPassed: 0,
    checksFailed: 0,
    passed: 0,
    merged: 0,
    cost: null,
    unpriced: 0,
    mixedCurrencies: false,
    medianMs: null,
    p90Ms: null,
    ...over,
  });

const MEMORY = partial<InsightsMemory>({
  period: partial<InsightsPeriodResponseDto>({ name: '30d' }),
  activeCount: 12,
  memoriesBriefed: 7,
  memoriesRead: 2,
  memoriesRecalled: 1,
  memoriesDelivered: 3,
  memoriesCutThenRead: 1,
  runsBriefed: 30,
  runsRead: 4,
  runsRecalled: 1,
  runsDelivered: 3,
  runsCutThenRead: 2,
  cutThenRead: [
    {
      memoryId: 'memory_2',
      handle: 'M-2',
      body: 'Uploads go through the signed URL.',
      runs: 2,
    },
  ],
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
  withMemories: tally(),
  withoutMemories: tally(),
  verdicts: [
    partial<MeasureVerdictResponseDto>({
      measure: 'accepted_rate',
      before: 0.5,
      after: 0.8,
      measuredBefore: 4,
      measuredAfter: 10,
      currency: null,
      verdict: 'insufficient',
    }),
  ],
});

const showing = () =>
  render(
    <MemoryRouter>
      <MemoryTab slug="acme" teamId="team_1" period="7d" />
    </MemoryRouter>,
  );

beforeEach(() => {
  answer.memory = queried(MEMORY);
  answer.requested = [];
});

describe('memory in Insights', () => {
  it('reads the team’s memory over the period', () => {
    showing();

    expect(answer.requested).toContainEqual({ teamId: 'team_1', period: '7d' });
  });

  it('shows a faithful skeleton while it loads', () => {
    answer.memory = queried(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the memory' }),
    ).toBeInTheDocument();
  });

  it('offers to try again where it could not load', async () => {
    answer.memory = queried(undefined, 1);

    showing();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(answer.memory.refetch).toHaveBeenCalled();
  });

  it('leads to the team’s memory where it has none', () => {
    answer.memory = queried({
      ...MEMORY,
      activeCount: 0,
      memoriesBriefed: 0,
      memoriesRead: 0,
      memoriesRecalled: 0,
      memoriesDelivered: 0,
      flagged: [],
    });

    showing();

    expect(
      screen.getByRole('link', { name: 'Open the team’s memory' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/memory');
  });

  it('shows how memories were used, cut then read, flagged, and how runs with them went against runs without', () => {
    showing();

    const tiles = screen.getByLabelText('Memory use');
    const active = htmlElement(
      within(tiles)
        .getByText('Active memories')
        .closest('[data-slot="insights-tile"]'),
    );
    expect(active).toHaveTextContent('12');
    expect(
      within(tiles).getByText('In the briefs of 30 runs'),
    ).toBeInTheDocument();

    const compared = screen.getByRole('list', {
      name: 'Runs without memories compared with runs with them',
    });
    expect(
      within(compared).getByText('Accepted rate').closest('li'),
    ).toHaveTextContent('Accepted rateWithout50%With80%ChangeToo few runs');

    const flagged = screen.getByRole('list', {
      name: 'Memories flagged wrong',
    });
    expect(within(flagged).getByRole('link', { name: 'M-1' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/memory?memory=memory_1',
    );
    expect(flagged).toHaveTextContent('Ada Lovelace');

    const cut = screen.getByRole('list', { name: 'Memories cut, then read' });
    expect(within(cut).getByRole('link', { name: 'M-2' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/memory?memory=memory_2',
    );
    expect(screen.getByText(/This happened in 2 runs/)).toBeInTheDocument();
    expect(screen.queryByText('No benchmark yet')).not.toBeInTheDocument();
  });
});
