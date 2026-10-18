import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { EntryDetail } from '@/components/features/replays/replay/EntryDetail';
import type { EntryComparison, ReplayEntry } from '@/lib/replay';

vi.mock('@/components/features/replays/outcome/EntryOutcome', () => ({
  EntryOutcome: () => null,
}));

const repeat = (repeat: number): ReplayEntry =>
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

const row = (baselineRepeats: number): EntryComparison =>
  ({
    originalRunId: 'run_1',
    taskId: 'task_1',
    title: 'Fix the queue',
    candidate: [repeat(1)],
    baseline: Array.from({ length: baselineRepeats }, (_, at) =>
      repeat(at + 1),
    ),
  }) as unknown as EntryComparison;

const shown = (referenceLabel: string, baselineRepeats = 1) =>
  render(
    <MemoryRouter>
      <EntryDetail
        slug="acme"
        teamId="team_1"
        row={row(baselineRepeats)}
        referenceLabel={referenceLabel}
        open
        onClose={vi.fn()}
      />
    </MemoryRouter>,
  );

describe('EntryDetail', () => {
  it('names the side the replay is compared with by its reference', () => {
    shown('Live config');

    expect(screen.getByText('This replay')).toBeInTheDocument();
    expect(screen.getByText('Live config')).toBeInTheDocument();
    expect(screen.queryByText('Baseline')).toBeNull();
  });

  it('names each repeat of the reference', () => {
    shown('Search’s starting config', 2);

    expect(
      screen.getByText('Search’s starting config, repeat 1'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Search’s starting config, repeat 2'),
    ).toBeInTheDocument();
  });
});
