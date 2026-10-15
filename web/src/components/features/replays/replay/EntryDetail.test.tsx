import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { EntryDetail } from '@/components/features/replays/replay/EntryDetail';
import type { EntryComparison, ReplayEntry } from '@/lib/replay';

vi.mock('@/components/features/replays/outcome/EntryOutcome', () => ({
  EntryOutcome: () => null,
}));

const copy = (repeat: number): ReplayEntry =>
  ({
    originalRunId: 'run_1',
    repeat,
    runId: null,
    state: 'finished',
    result: 'succeeded',
    reason: null,
    judge: null,
    pair: null,
  }) as unknown as ReplayEntry;

const row = (baselineCopies: number): EntryComparison =>
  ({
    originalRunId: 'run_1',
    taskId: 'task_1',
    title: 'Fix the queue',
    candidate: [copy(1)],
    baseline: Array.from({ length: baselineCopies }, (_, at) => copy(at + 1)),
  }) as unknown as EntryComparison;

const shown = (counterpartLabel: string, baselineCopies = 1) =>
  render(
    <MemoryRouter>
      <EntryDetail
        slug="acme"
        teamId="team_1"
        row={row(baselineCopies)}
        counterpartLabel={counterpartLabel}
        open
        onClose={vi.fn()}
      />
    </MemoryRouter>,
  );

describe('EntryDetail', () => {
  it('names the side the replay is compared with by its counterpart', () => {
    shown('Live config');

    expect(screen.getByText('This replay')).toBeInTheDocument();
    expect(screen.getByText('Live config')).toBeInTheDocument();
    expect(screen.queryByText('Baseline')).toBeNull();
  });

  it('names each copy of the counterpart', () => {
    shown('Search’s starting config', 2);

    expect(
      screen.getByText('Search’s starting config, copy 1'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Search’s starting config, copy 2'),
    ).toBeInTheDocument();
  });
});
