import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetHealth } from '@/components/features/replays/set/health/SetHealth';
import type { ReplaySet, StationLive } from '@/lib/replay';
import type { SetHealth as Health } from '@/lib/replay-words';

const probe = vi.fn();
const sanity = vi.fn();

vi.mock('@/hooks/api/useProbeReplaySet', () => ({
  useProbeReplaySet: () => ({
    mutate: probe,
    isPending: false,
    isError: false,
    reset: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useStartSanityReplay', () => ({
  useStartSanityReplay: () => ({
    mutate: sanity,
    isPending: false,
    isError: false,
    reset: vi.fn(),
  }),
}));

const HARNESSES = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    models: [
      { id: 'sonnet', name: 'Sonnet' },
      { id: 'opus', name: 'Opus' },
    ],
    efforts: ['low', 'medium', 'high'],
  },
];

const harnesses = vi.fn();

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => harnesses(),
}));

const NEVER_READ: Health = {
  noise: null,
  saturation: null,
  judge: null,
  checks: null,
  sanity: null,
};

const read = {
  data: [] as unknown,
  isPending: false,
  errorUpdateCount: 0,
  isFetching: false,
  refetch: vi.fn(),
};
const waiting = { ...read, data: undefined, isPending: true };
const unread = { ...read, data: undefined, errorUpdateCount: 1 };

const AT = {
  slug: 'acme',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
};

const LIVE: StationLive = {
  harness: 'claude-code',
  model: 'sonnet',
  effort: 'medium',
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
  health: NEVER_READ,
  minGain: 0.05,
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
    sanity: {
      replayId: 'replay_stronger',
      candidateId: 'candidate_stronger',
      model: 'opus',
      effort: null,
      repeats: 1,
      state: 'finished',
      againstReplayId: 'replay_probe',
      againstState: 'finished',
      gain: {
        gain: -0.05,
        low: -0.2,
        high: 0.1,
        verdict: 'within-noise',
        minGain: 0.05,
        tasks: 2,
      },
      rewardsStrongerModel: false,
      worse: [
        {
          taskId: 'task_b',
          originalRunId: 'run_task_b',
          live: 1,
          stronger: 0.33,
        },
      ],
    },
  },
};

const renderHealth = (
  set: ReplaySet,
  live: StationLive | null = LIVE,
  liveQuery: typeof read = read,
) =>
  render(
    <MemoryRouter>
      <SetHealth at={AT} set={set} live={live} liveQuery={liveQuery} />
    </MemoryRouter>,
  );

const healthBox = () => screen.getByRole('region', { name: 'Health' });

const line = (key: string) =>
  healthBox().querySelector(`[data-slot="health-line"][data-key="${key}"]`);

const PATH = '/w/acme/team/team_1/lines/line_1/stations/station_1';

describe('SetHealth', () => {
  beforeEach(() => {
    probe.mockClear();
    sanity.mockClear();
    harnesses.mockReturnValue({
      data: HARNESSES,
      isPending: false,
      errorUpdateCount: 0,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it('says what was never read, and checks the set within a ceiling', async () => {
    renderHealth(SET);

    expect(line('noise')).toHaveTextContent('Not measured');
    expect(line('judge')).toHaveTextContent('Not checked');
    expect(line('sanity')).toHaveTextContent('Not tried');
    expect(line('checks')).toHaveTextContent(
      'Check this set to run the station’s check a second time',
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Check this set' }),
    );
    await userEvent.type(screen.getByLabelText('Most it may spend'), '8');
    await userEvent.click(
      screen.getByRole('button', { name: 'Start the check' }),
    );

    expect(probe).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        setId: 'set_1',
        ceiling: { amount: 8, currency: 'USD' },
      },
      expect.anything(),
    );
  });

  it('reads an unhealthy set line by line, with the flaky checks and the tasks a stronger model did worse on', () => {
    renderHealth(UNHEALTHY);

    expect(line('noise')).toHaveAttribute('data-tone', 'bad');
    expect(line('noise')).toHaveTextContent('Each copy: 50%, 60%, 70%');
    expect(
      within(
        screen.getByRole('list', { name: 'Tasks that went both ways' }),
      ).getByText('Retry jobs'),
    ).toBeInTheDocument();
    expect(line('saturation')).toHaveTextContent(
      'Almost none: the live config succeeds on 97%',
    );
    expect(line('judge')).toHaveTextContent(
      'Same verdict on 60% of 10 changes',
    );
    expect(line('judge')).toHaveTextContent('Make the rubric more specific');
    expect(line('checks')).toHaveTextContent('1 of 6 changes flipped');
    expect(
      within(
        screen.getByRole('list', { name: 'Tasks whose check flipped' }),
      ).getByRole('link', { name: 'Fix the queue' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_probe_a');
    expect(line('checks')).toHaveTextContent('Passed, then failed');
    expect(line('sanity')).toHaveTextContent('opus did not do clearly better');
    expect(
      within(
        screen.getByRole('list', {
          name: 'Tasks the stronger model did worse on',
        }),
      ).getByRole('link', { name: 'Retry jobs' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_task_b');
    expect(line('sanity')).toHaveTextContent('100% live, 33% stronger');
    expect(
      within(line('sanity') as HTMLElement).getByRole('link', {
        name: 'Its replay',
      }),
    ).toHaveAttribute('href', `${PATH}/replays/replay_stronger`);
  });

  it('will not replay under the live config’s own model and effort', async () => {
    renderHealth(SET);

    await userEvent.click(
      screen.getByRole('button', { name: 'Try a stronger model' }),
    );
    await userEvent.type(screen.getByLabelText('Most it may spend'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Start replay' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose a model or an effort other than the live config’s.',
    );
    expect(sanity).not.toHaveBeenCalled();
  });

  it('replays the set with the stronger model chosen', async () => {
    const user = userEvent.setup();
    renderHealth(SET);

    await user.click(
      screen.getByRole('button', { name: 'Try a stronger model' }),
    );
    await user.click(screen.getByRole('button', { name: 'Model and effort' }));
    await user.click(await screen.findByRole('menuitem', { name: /Model/ }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Opus' }));
    fireEvent.change(screen.getByLabelText('Most it may spend'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start replay' }));

    expect(sanity).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        setId: 'set_1',
        stronger: { model: 'opus' },
        ceiling: { amount: 5, currency: 'USD' },
        repeats: 1,
      },
      expect.anything(),
    );
  });

  it('explains what it takes, and refuses an effort no higher than the live one before asking', async () => {
    const user = userEvent.setup();
    renderHealth(SET);

    await user.click(
      screen.getByRole('button', { name: 'Try a stronger model' }),
    );

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Pick a model the harness offers, or a higher effort than the live config’s medium: high.',
    );

    await user.click(screen.getByRole('button', { name: 'Model and effort' }));
    await user.click(await screen.findByRole('menuitem', { name: /Effort/ }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'low' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'That effort is not higher than the live config’s.',
    );
  });

  it.each([
    ['stopped', 'was stopped'],
    ['gone', 'is gone'],
  ] as const)(
    'says a comparison whose live replay %s cannot be made, and offers to try again',
    async (againstState, said) => {
      renderHealth({
        ...SET,
        health: {
          ...NEVER_READ,
          sanity: {
            ...(UNHEALTHY.health.sanity as NonNullable<
              ReplaySet['health']['sanity']
            >),
            againstState,
            gain: null,
            rewardsStrongerModel: null,
            worse: [],
          },
        },
      });

      expect(line('sanity')).toHaveTextContent('Could not be compared');
      expect(line('sanity')).toHaveTextContent(
        `The live replay it was compared with ${said}, so this can’t be compared.`,
      );

      await userEvent.click(
        within(line('sanity') as HTMLElement).getByRole('button', {
          name: 'Try again',
        }),
      );

      expect(screen.getByRole('dialog')).toHaveTextContent(
        'Try a stronger model on Queue fixes',
      );
    },
  );

  it('cannot try a stronger model at a station without a harness, and says why', () => {
    renderHealth(SET, { harness: null, model: null, effort: null });

    expect(
      screen.getByRole('button', { name: 'Try a stronger model' }),
    ).toBeDisabled();
    expect(healthBox()).toHaveTextContent(
      'The station names no harness, so there is no model to choose.',
    );
  });

  it('waits for the station before offering a stronger model, without a reason', () => {
    renderHealth(SET, null, waiting);

    const button = screen.getByRole('button', { name: 'Try a stronger model' });

    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('aria-describedby');
    expect(healthBox()).not.toHaveTextContent('The station names no harness');
  });

  it('says the station could not be loaded, ties it to the button and retries', async () => {
    const refetch = vi.fn();
    renderHealth(SET, null, { ...unread, refetch });

    const button = screen.getByRole('button', { name: 'Try a stronger model' });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      /The station’s model could not be loaded/,
    );
    expect(healthBox()).not.toHaveTextContent('The station names no harness');

    await userEvent.click(
      within(healthBox()).getByRole('button', { name: 'Try again' }),
    );

    expect(refetch).toHaveBeenCalled();
  });

  it('ties a refusal to its button', () => {
    renderHealth(SET, { harness: null, model: null, effort: null });

    expect(
      screen.getByRole('button', { name: 'Try a stronger model' }),
    ).toHaveAccessibleDescription(
      'The station names no harness, so there is no model to choose.',
    );
  });

  it('tries the stronger model again with the config it tried before, saying a refusal once', async () => {
    const retryable: ReplaySet = {
      ...SET,
      health: {
        ...NEVER_READ,
        sanity: {
          ...(UNHEALTHY.health.sanity as NonNullable<
            ReplaySet['health']['sanity']
          >),
          model: 'opus',
          effort: 'high',
          state: 'stopped',
          gain: null,
          rewardsStrongerModel: null,
          worse: [],
        },
      },
    };
    const { unmount } = renderHealth(retryable);

    await userEvent.click(
      within(line('sanity') as HTMLElement).getByRole('button', {
        name: 'Try again',
      }),
    );
    fireEvent.change(screen.getByLabelText('Most it may spend'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start replay' }));

    expect(sanity).toHaveBeenCalledWith(
      expect.objectContaining({ stronger: { model: 'opus', effort: 'high' } }),
      expect.anything(),
    );

    unmount();
    renderHealth(retryable, { harness: null, model: null, effort: null });

    expect(
      healthBox().textContent?.split('The station names no harness').length,
    ).toBe(2);
    expect(
      within(line('sanity') as HTMLElement).getByRole('button', {
        name: 'Try again',
      }),
    ).toBeDisabled();
  });

  it('holds back the hint and its checks until the harness’s models are read', async () => {
    harnesses.mockReturnValue({
      data: undefined,
      isPending: true,
      errorUpdateCount: 0,
      isFetching: true,
      refetch: vi.fn(),
    });
    renderHealth(SET);

    await userEvent.click(
      screen.getByRole('button', { name: 'Try a stronger model' }),
    );

    expect(screen.getByRole('dialog')).not.toHaveTextContent(
      'Pick a model the harness offers',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says the harness’s models could not be loaded, and retries', async () => {
    const refetch = vi.fn();
    harnesses.mockReturnValue({
      data: undefined,
      isPending: false,
      errorUpdateCount: 1,
      isFetching: false,
      refetch,
    });
    renderHealth(SET);

    await userEvent.click(
      screen.getByRole('button', { name: 'Try a stronger model' }),
    );

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'The harness’s models and efforts could not be loaded.',
    );

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Try again',
      }),
    );

    expect(refetch).toHaveBeenCalled();
  });

  it('counts a live config with no effort of its own as the lowest the harness offers', async () => {
    renderHealth(SET, { ...LIVE, effort: null });

    await userEvent.click(
      screen.getByRole('button', { name: 'Try a stronger model' }),
    );

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Pick a model the harness offers, or a higher effort than the live config’s default, counted as its lowest, low: medium, high.',
    );
  });
});
