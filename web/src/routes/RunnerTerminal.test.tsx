import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunnerTerminal } from '@/routes/RunnerTerminal';

const state = vi.hoisted(() => ({
  session: null as { id: string } | null,
  start: {
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null as Error | null,
    variables: undefined as { runnerId: string } | undefined,
    mutate: vi.fn(),
    reset: vi.fn(),
  },
  stop: {
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null as Error | null,
    mutate: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock('@/components/runners/RunTerminal', () => ({
  RunTerminal: () => <div>terminal</div>,
}));

vi.mock('@/hooks/api/useRunners', () => ({
  runnerKeys: { all: ['runners'] },
  useRunners: () => ({
    data: [
      {
        id: 'runner_1',
        name: 'Build server',
        pool: 'dev',
        connected: true,
        lastSeenAt: '2026-08-24T12:00:00.000Z',
        revokedAt: null,
        currentRun: state.session,
      },
    ],
  }),
}));

vi.mock('@/hooks/api/useRunnerSession', () => ({
  useStartSession: () => state.start,
  useStopSession: () => state.stop,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/runners/runner_1']}>
      <Routes>
        <Route path="/w/:slug/runners/:runnerId" element={<RunnerTerminal />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  state.session = null;
  state.start = {
    ...state.start,
    isPending: false,
    isSuccess: false,
    variables: undefined,
    reset: vi.fn(),
  };
  state.stop = {
    ...state.stop,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  };
});

describe('RunnerTerminal', () => {
  it('says the runner is waiting while the start is in flight', () => {
    state.start.isPending = true;
    state.start.variables = { runnerId: 'runner_1' };

    renderPage();

    expect(screen.getByText(/Waiting for the runner/)).toBeInTheDocument();
  });

  it('forgets the start once the session it asked for exists', () => {
    state.session = { id: 'run_1' };
    state.start.isSuccess = true;
    state.start.variables = { runnerId: 'runner_1' };

    renderPage();

    expect(state.start.reset).toHaveBeenCalled();
  });

  it('offers to start again once the session has ended', () => {
    state.session = null;
    state.start.isSuccess = false;
    state.start.variables = { runnerId: 'runner_1' };

    renderPage();

    expect(screen.getByText('This runner is idle.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start session' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Waiting for the runner/),
    ).not.toBeInTheDocument();
  });

  it('covers the terminal from the click until the session is gone', () => {
    state.session = { id: 'run_1' };
    state.stop.isSuccess = true;

    renderPage();

    expect(
      document.querySelector('[data-slot="session-ending"]'),
    ).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Stopping…' })).toBeDisabled();
  });

  it('leaves the terminal alone when no stop has been asked for', () => {
    state.session = { id: 'run_1' };

    renderPage();

    expect(document.querySelector('[data-slot="session-ending"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled();
  });

  it('forgets the stop once the session it ended is gone', () => {
    state.session = null;
    state.stop.isSuccess = true;

    renderPage();

    expect(state.stop.reset).toHaveBeenCalled();
  });

  it('says so when the stop could not be delivered', () => {
    state.session = { id: 'run_1' };
    state.stop.isError = true;
    state.stop.error = new Error('Could not stop the session');

    renderPage();

    expect(screen.getByText('Could not stop the session')).toBeInTheDocument();
  });

  it('leaves another runner alone while this one is starting', () => {
    state.start.isPending = true;
    state.start.variables = { runnerId: 'runner_2' };

    renderPage();

    expect(screen.getByText('This runner is idle.')).toBeInTheDocument();
  });
});
