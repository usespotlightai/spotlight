import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SetNoise } from '@/components/features/replays/set/SetNoise';
import type { ReplaySet } from '@/lib/replay';

vi.mock('@/hooks/api/useStartReplay', () => ({
  useStartReplay: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useStationCandidates', () => ({
  useStationCandidates: () => ({
    candidates: { data: [], isPending: false, errorUpdateCount: 0 },
  }),
}));

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

const entry = (taskId: string, title: string | null) => ({
  runId: `run_${taskId}`,
  taskId,
  title,
  state: 'completed',
  endedAt: null,
  addedAt: '2026-10-01T09:00:00.000Z',
  refusal: null,
  reason: null,
});

const SET: ReplaySet = {
  id: 'set_1',
  lineId: 'line_1',
  stationId: 'station_1',
  name: 'Queue fixes',
  createdAt: '2026-10-01T09:00:00.000Z',
  stationGone: false,
  guardsChanges: false,
  noise: null,
  minGain: 0.05,
  entries: [entry('task_a', 'Fix the queue'), entry('task_b', 'Retry jobs')],
};

const renderNoise = (set: ReplaySet) =>
  render(
    <MemoryRouter>
      <SetNoise at={AT} set={set} baseline={{ repeats: 3 }} />
    </MemoryRouter>,
  );

const noiseBox = () => screen.getByRole('region', { name: 'Noise' });

describe('SetNoise', () => {
  it('says the noise was never measured, and offers to measure it with 3 copies', async () => {
    renderNoise(SET);

    expect(noiseBox()).toHaveTextContent('Not measured');
    expect(noiseBox()).toHaveTextContent(
      'Replay the live config over the set 3 times',
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Measure noise' }),
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Repeats' })).toHaveValue('3');
    expect(screen.getByRole('radio', { name: /Live config/ })).toBeChecked();
  });

  it('shows how far success moved between copies, each copy’s rate and the tasks that went both ways', () => {
    renderNoise({
      ...SET,
      noise: {
        replayId: 'replay_noise',
        fingerprint: 'abcdef1234567890',
        repeats: 3,
        perRepeat: [0.5, 0.6, 0.7],
        spread: 0.2,
        flippedTasks: ['task_b'],
        measuredAt: '2026-10-02T09:00:00.000Z',
      },
    });

    expect(noiseBox()).toHaveTextContent(
      'Success moved 20 pts between 3 copies',
    );
    expect(noiseBox()).toHaveTextContent(
      'more than the +5 pts the line counts as real',
    );
    expect(noiseBox()).toHaveTextContent('Each copy: 50%, 60%, 70%');
    expect(noiseBox()).toHaveTextContent('1 task went both ways');
    expect(
      within(
        screen.getByRole('list', { name: 'Tasks that went both ways' }),
      ).getByText('Retry jobs'),
    ).toBeInTheDocument();
    expect(
      noiseBox().querySelector('[data-slot="fingerprint"]'),
    ).toHaveAttribute('title', 'abcdef1234567890');
    expect(screen.getByRole('link', { name: 'Its replay' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1/replays/replay_noise',
    );
  });

  it('cannot measure the noise of a set without runs, and says why', () => {
    renderNoise({ ...SET, entries: [] });

    expect(
      screen.getByRole('button', { name: 'Measure noise' }),
    ).toBeDisabled();
    expect(noiseBox()).toHaveTextContent('Add runs to the set first.');
  });
});
