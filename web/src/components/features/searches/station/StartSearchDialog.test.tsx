import { fireEvent, render, screen, within } from '@testing-library/react';
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
  health: {
    noise: null,
    saturation: null,
    judge: null,
    checks: null,
    sanity: null,
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
  entries: Array.from({ length: tasks }, (_, place) => ({
    runId: `run_${id}_${place}`,
    taskId: `task_${place}`,
    title: null,
    state: 'completed',
    endedAt: null,
    addedAt: '2026-10-01T09:00:00.000Z',
    refusal: null,
    reason: null,
    outcome: 'other',
    origin: 'person',
  })),
});

const SETS = [setOf('small', 'Two tasks', 2), setOf('big', 'Billing work', 7)];

const ESTIMATE: SearchEstimate = {
  objective: 'success',
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
  minGain: 0.05,
  warnings: [],
};

const renderDialog = (sets: readonly ReplaySet[] = SETS) =>
  render(
    <MemoryRouter>
      <StartSearchDialog at={AT} sets={sets} open onOpenChange={vi.fn()} />
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
      'Please fix the marked field to see an estimate.',
    );
  });

  it('chooses the first set big enough to search, and says why a smaller one is not', () => {
    renderDialog();

    expect(screen.getByRole('radio', { name: /Billing work/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Two tasks/ })).toBeDisabled();
    expect(
      screen.getByText(
        'Covers 2 tasks. A search holds some out. Minimum different tasks: 5',
      ),
    ).toBeInTheDocument();
  });

  it('says what is wrong with a budget field as it is typed', () => {
    renderDialog();

    fireEvent.change(screen.getByRole('textbox', { name: 'Iterations' }), {
      target: { value: '11' },
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please enter a whole number from 1 to 10.',
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
    expect(summary).toHaveTextContent('CopiesEach run once');
    expect(screen.queryByRole('list', { name: 'Warnings' })).toBeNull();
  });

  it('warns that nobody measured the set’s noise, and starts all the same', () => {
    estimate.mockReturnValue({
      ...ESTIMATE,
      warnings: [{ kind: 'noise-unmeasured' }],
    });

    renderDialog();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Most it may spend' }),
      { target: { value: '20' } },
    );

    const warnings = screen.getByRole('list', { name: 'Warnings' });
    expect(
      warnings.querySelector('[data-kind="noise-unmeasured"]'),
    ).toHaveTextContent(/Set’s noise is unmeasured/);
    expect(
      screen.getByRole('button', { name: 'Start search' }),
    ).not.toBeDisabled();
  });

  it('offers the repeats that would bring a noisy set’s noise down', () => {
    estimate.mockReturnValue({
      ...ESTIMATE,
      warnings: [
        {
          kind: 'noisy',
          spread: 0.15,
          minGain: 0.05,
          suggestedRepeats: 5,
          neededRepeats: 5,
        },
      ],
    });

    renderDialog();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Most it may spend' }),
      { target: { value: '20' } },
    );

    expect(screen.getByRole('list', { name: 'Warnings' })).toHaveTextContent(
      'Success moved 15 pts between copies of the same runs, above the line’s minimum real gain. Replaying each run 5 times would bring it under. Minimum real gain: +5 pts',
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Replay each run 5 times' }),
    );

    expect(screen.getByRole('textbox', { name: 'Repeats' })).toHaveValue('5');
    expect(
      screen.queryByRole('button', { name: 'Replay each run 5 times' }),
    ).toBeNull();
    expect(screen.getByRole('region', { name: 'Estimate' })).toHaveTextContent(
      'Each run 5 times',
    );
  });

  it('starts the search on the chosen set with the budget and agent, leaving its aim to the server until the estimate has one', () => {
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
          repeats: 1,
          ceiling: { amount: 20, currency: 'USD' },
        },
        agent: { harness: 'claude-code', model: null },
        objective: null,
      },
      expect.anything(),
    );
  });

  it('aims for the same success for less on a set the live config saturates, and says why', () => {
    estimate.mockReturnValue({
      ...ESTIMATE,
      objective: 'cost',
      warnings: [{ kind: 'saturated', rate: 0.97 }],
    });

    renderDialog();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Most it may spend' }),
      { target: { value: '20' } },
    );

    const aim = screen.getByRole('group', { name: 'Aim for' });
    expect(
      within(aim).getByRole('radio', { name: /The same success for less/ }),
    ).toBeChecked();
    expect(aim).toHaveTextContent(
      'Suggested: the live config already succeeds on 97% of this set. Little room for more success.',
    );
    expect(
      screen
        .getByRole('list', { name: 'Warnings' })
        .querySelector('[data-kind="saturated"]'),
    ).toHaveTextContent('Aim for the same success for less');

    fireEvent.click(within(aim).getByRole('radio', { name: /More success/ }));

    expect(aim).not.toHaveTextContent('Chosen for you');

    fireEvent.click(screen.getByRole('button', { name: 'Start search' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ objective: 'success' }),
      expect.anything(),
    );
  });

  it('shows the aim a saturated set takes before the estimate arrives, without asking for it', () => {
    const big = setOf('big', 'Billing work', 7);
    renderDialog([
      {
        ...big,
        health: {
          ...big.health,
          saturation: {
            replayId: 'replay_live',
            rate: 0.97,
            interval: { rate: 0.97, low: 0.9, high: 1 },
            saturated: true,
            measuredAt: '2026-10-02T09:00:00.000Z',
          },
        },
      },
    ]);
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Most it may spend' }),
      { target: { value: '20' } },
    );

    const aim = screen.getByRole('group', { name: 'Aim for' });
    expect(
      within(aim).getByRole('radio', { name: /The same success for less/ }),
    ).toBeChecked();
    expect(aim).toHaveTextContent('Suggested');

    fireEvent.click(screen.getByRole('button', { name: 'Start search' }));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ objective: null }),
      expect.anything(),
    );
  });

  it('warns of a judge that disagrees with itself, flaky checks and a set that does not reward a stronger model', () => {
    estimate.mockReturnValue({
      ...ESTIMATE,
      warnings: [
        { kind: 'judge-unstable', agreement: 0.6, compared: 10 },
        { kind: 'flaky-checks', flaky: 2, rechecked: 9 },
        {
          kind: 'sanity-failed',
          gain: -0.02,
          low: -0.1,
          high: 0.06,
          worseTasks: 3,
        },
      ],
    });

    renderDialog();
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Most it may spend' }),
      { target: { value: '20' } },
    );

    const warnings = screen.getByRole('list', { name: 'Warnings' });
    expect(
      warnings.querySelector('[data-kind="judge-unstable"]'),
    ).toHaveTextContent('Judge gave the same verdict twice on only 60%');
    expect(
      warnings.querySelector('[data-kind="flaky-checks"]'),
    ).toHaveTextContent('on 2 of 9 changes it ran twice');
    expect(
      warnings.querySelector('[data-kind="sanity-failed"]'),
    ).toHaveTextContent('−2 pts, likely −10 to +6. It did worse on 3 tasks');
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
      screen.getByText('Please enter a ceiling above 0.'),
    ).toBeInTheDocument();
  });
});
