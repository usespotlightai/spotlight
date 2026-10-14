import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SetHealth } from '@/components/features/replays/set/health/SetHealth';
import type { ReplaySet } from '@/lib/replay';
import type { SetHealth as Health } from '@/lib/replay-words';

const NEVER_READ: Health = {
  noise: null,
  saturation: null,
  judge: null,
  checks: null,
  oracle: null,
};

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

const entry = (
  taskId: string,
  title: string | null,
): ReplaySet['entries'][number] => ({
  runId: `run_${taskId}`,
  taskId,
  title,
  state: 'completed',
  endedAt: null,
  addedAt: '2026-10-01T09:00:00.000Z',
  refusal: null,
  reason: null,
  outcome: 'other',
  origin: 'person',
});

const SET: ReplaySet = {
  id: 'set_1',
  lineId: 'line_1',
  stationId: 'station_1',
  name: 'Queue fixes',
  createdAt: '2026-10-01T09:00:00.000Z',
  stationGone: false,
  guardsChanges: false,
  health: NEVER_READ,
  minGain: 0.05,
  composition: {
    outcomes: [
      { outcome: 'accepted', count: 0 },
      { outcome: 'sent-back', count: 0 },
      { outcome: 'asked', count: 0 },
      { outcome: 'failed', count: 0 },
      { outcome: 'other', count: 2 },
    ],
    origins: [{ origin: 'person', count: 2 }],
    oldest: null,
    median: null,
    newest: null,
    balanceWarning: null,
  },
  entries: [entry('task_a', 'Fix the queue'), entry('task_b', 'Retry jobs')],
};

const UNHEALTHY: ReplaySet = {
  ...SET,
  health: {
    noise: {
      replayId: 'replay_probe',
      fingerprint: 'abcdef1234567890',
      repeats: 3,
      perRepeat: [0.5, 0.6, 0.7],
      spread: 0.2,
      flippedTasks: ['task_b'],
      measuredAt: '2026-10-02T09:00:00.000Z',
      noisyInOneCopy: true,
    },
    saturation: {
      replayId: 'replay_probe',
      rate: 0.97,
      interval: { rate: 0.97, low: 0.9, high: 1 },
      saturated: true,
      measuredAt: '2026-10-02T09:00:00.000Z',
    },
    judge: {
      replayId: 'replay_probe',
      compared: 10,
      agreed: 6,
      pending: 0,
      agreement: 0.6,
      unstable: true,
    },
    checks: {
      replayId: 'replay_probe',
      rechecked: 6,
      pending: 0,
      flaky: [
        {
          taskId: 'task_a',
          originalRunId: 'run_task_a',
          runId: 'run_probe_a',
          first: 'passed',
          recheck: 'failed',
        },
      ],
    },
    oracle: {
      replayId: 'replay_oracle',
      candidateId: 'candidate_oracle',
      repeats: 1,
      state: 'finished',
      againstReplayId: 'replay_probe',
      againstState: 'finished',
      answered: 6,
      live: 0.95,
      withAnswer: 0.97,
      gain: {
        gain: 0.02,
        low: -0.05,
        high: 0.08,
        verdict: 'within-noise',
        minGain: 0.05,
        tasks: 6,
      },
      roomToImprove: false,
    },
  },
};

const renderHealth = (set: ReplaySet) =>
  render(
    <MemoryRouter>
      <SetHealth at={AT} set={set} />
    </MemoryRouter>,
  );

const healthBox = () => screen.getByRole('region', { name: 'Health' });

const line = (key: string) =>
  healthBox().querySelector(`[data-slot="health-line"][data-key="${key}"]`);

const PATH = '/w/acme/team/team_1/lines/line_1/stations/station_1';

describe('SetHealth', () => {
  it('says what was never read, and offers no button: Spotlight measures it', () => {
    renderHealth(SET);

    expect(line('noise')).toHaveTextContent('Not measured');
    expect(line('saturation')).toHaveTextContent('Not measured');
    expect(line('judge')).toHaveTextContent('Not checked');
    expect(line('checks')).toHaveTextContent('Not checked');
    expect(within(healthBox()).queryByRole('button')).toBeNull();
  });

  it('reads an unhealthy set line by line, with the flaky checks and the room the answer leaves', () => {
    renderHealth(UNHEALTHY);

    expect(line('noise')).toHaveAttribute('data-tone', 'bad');
    expect(line('noise')).toHaveTextContent('Each copy: 50%, 60%, 70%');
    expect(
      within(
        screen.getByRole('list', { name: 'Tasks that went both ways' }),
      ).getByText('Retry jobs'),
    ).toBeInTheDocument();
    expect(line('saturation')).toHaveAttribute('data-tone', 'bad');
    expect(line('saturation')).toHaveTextContent(
      'Little: +2 pts with the answer',
    );
    expect(
      within(line('saturation') as HTMLElement).getByRole('link', {
        name: 'View replay',
      }),
    ).toHaveAttribute('href', `${PATH}/replays/replay_oracle`);
    expect(document.body).toHaveTextContent(
      'Live config: 95% on 6 runs. With the answer: 97%.',
    );
    expect(line('judge')).toHaveTextContent(
      'Same verdict on 60% of 10 changes',
    );
    expect(line('checks')).toHaveTextContent('1 of 6 changes flipped');
    expect(
      within(
        screen.getByRole('list', { name: 'Tasks whose check flipped' }),
      ).getByRole('link', { name: 'Fix the queue' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_probe_a');
    expect(line('checks')).toHaveTextContent('Passed, then failed');
  });
});
