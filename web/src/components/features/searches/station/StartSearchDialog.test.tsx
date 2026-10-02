import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StartSearchDialog } from '@/components/features/searches/station/StartSearchDialog';
import type { ReplaySet } from '@/lib/replay';
import type { SearchEstimate } from '@/lib/search';

const mutate = vi.fn();
const startError = vi.fn((): unknown => null);
const estimate = vi.fn((): SearchEstimate | undefined => undefined);
const estimateError = vi.fn((): unknown => null);

vi.mock('@/hooks/api/useStartSearch', () => ({
  useStartSearch: () => ({
    mutate,
    isPending: false,
    reset: vi.fn(),
    error: startError(),
  }),
}));

vi.mock('@/hooks/api/useSearchEstimate', () => ({
  useSearchEstimate: () => ({
    data: estimate(),
    isFetching: false,
    isError: estimateError() !== null,
    error: estimateError(),
  }),
}));

vi.mock('@/hooks/useDebounced', () => ({
  useDebounced: <T,>(value: T) => value,
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [
      {
        id: 'claude-code',
        name: 'Claude Code',
        models: [],
        efforts: [],
      },
    ],
  }),
}));

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

const setOf = (id: string, name: string, tasks: number): ReplaySet => ({
  id,
  lineId: 'line_1',
  stationId: 'station_1',
  name,
  createdAt: '2026-10-01T09:00:00.000Z',
  stationGone: false,
  guardsChanges: false,
  entries: Array.from({ length: tasks }, (_, place) => ({
    runId: `run_${id}_${place}`,
    taskId: `task_${place}`,
    title: null,
    state: 'completed',
    endedAt: null,
    addedAt: '2026-10-01T09:00:00.000Z',
    refusal: null,
    reason: null,
  })),
});

const SETS = [setOf('small', 'Two tasks', 2), setOf('big', 'Billing work', 7)];

const ESTIMATE: SearchEstimate = {
  searchedTasks: 5,
  heldOutTasks: 2,
  runs: { seed: 7, searchReplays: 30, heldOutReplays: 8, agent: 3, total: 48 },
  ceiling: { amount: 20, currency: 'USD' },
  perReplayAllotments: {
    seed: { amount: 2.5, currency: 'USD' },
    searchReplay: { amount: 1.8, currency: 'USD' },
    heldOutReplay: { amount: 0.7, currency: 'USD' },
    agentRun: { amount: 0.66, currency: 'USD' },
  },
  estimatedDuration: 5_400_000,
};

const renderDialog = () =>
  render(
    <MemoryRouter>
      <StartSearchDialog at={AT} sets={SETS} open onOpenChange={vi.fn()} />
    </MemoryRouter>,
  );

describe('StartSearchDialog', () => {
  beforeEach(() => {
    mutate.mockClear();
    startError.mockReturnValue(null);
    estimate.mockReturnValue(undefined);
    estimateError.mockReturnValue(null);
  });

  it('points to the field an estimate refused rather than waiting on it', () => {
    estimateError.mockReturnValue({
      status: 422,
      errors: [
        {
          path: 'budget.ceiling.amount',
          message: 'is too low to give each replay run a cent',
          severity: 'error',
        },
      ],
    });

    renderDialog();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Most it may spend' }),
      {
        target: { value: '0.01' },
      },
    );

    expect(
      screen.getByText('is too low to give each replay run a cent'),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Estimate' })).toHaveTextContent(
      'Fix the field marked above to see an estimate.',
    );
  });

  it('chooses the first set big enough to search, and says why a smaller one is not', () => {
    renderDialog();

    expect(screen.getByRole('radio', { name: /Billing work/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Two tasks/ })).toBeDisabled();
    expect(
      screen.getByText(
        'It covers 2 tasks; a search needs runs of at least 5 different tasks, to hold some out.',
      ),
    ).toBeInTheDocument();
  });

  it('says what is wrong with a budget field as it is typed', () => {
    renderDialog();

    fireEvent.change(screen.getByRole('textbox', { name: 'Iterations' }), {
      target: { value: '11' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Give a whole number from 1 to 10.',
    );
  });

  it('shows what the search may run, spend and take before it starts', () => {
    estimate.mockReturnValue(ESTIMATE);

    renderDialog();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Most it may spend' }),
      {
        target: { value: '20' },
      },
    );

    const summary = screen.getByRole('region', { name: 'Estimate' });
    expect(summary).toHaveTextContent('5 searched · 2 held out');
    expect(summary).toHaveTextContent('48 runs');
    expect(summary).toHaveTextContent('$20.00');
    expect(summary).toHaveTextContent('$1.80 per candidate');
    expect(summary).toHaveTextContent('About 1h 30m');
  });

  it('starts the search on the chosen set with the budget and agent', () => {
    renderDialog();

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Most it may spend' }),
      {
        target: { value: '20' },
      },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start search' }));

    expect(mutate).toHaveBeenCalledWith(
      {
        at: AT,
        setId: 'big',
        budget: {
          iterations: 3,
          perIteration: 2,
          concurrency: 4,
          ceiling: { amount: 20, currency: 'USD' },
        },
        agent: { harness: 'claude-code', model: null },
      },
      expect.anything(),
    );
  });

  it('shows a refusal on the field it names', () => {
    startError.mockReturnValue({
      status: 422,
      detail: 'The request is invalid',
      errors: [
        {
          path: 'budget.ceiling.amount',
          message: 'is too low to give each replay run a cent',
          severity: 'error',
        },
      ],
    });

    renderDialog();

    expect(
      screen.getByRole('textbox', { name: 'Most it may spend' }),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('is too low to give each replay run a cent'),
    ).toBeInTheDocument();
  });

  it('refuses to start without a ceiling', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Start search' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(
      screen.getByText('Give a ceiling above nothing.'),
    ).toBeInTheDocument();
  });
});
