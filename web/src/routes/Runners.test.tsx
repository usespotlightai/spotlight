import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Runners } from '@/routes/Runners';

const fleet = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useRunners', () => ({
  runnerKeys: { all: ['runners'] },
  useRunners: () => ({
    data: fleet(),
    isPending: fleet() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [
      { id: 'claude-code', name: 'Claude Code' },
      { id: 'other', name: 'Other Harness' },
    ],
  }),
}));

vi.mock('@/hooks/api/useEnrolRunner', () => ({
  useEnrolRunner: () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false }),
}));

const runner = (over: Record<string, unknown> = {}) => ({
  id: 'runner_1',
  name: 'Laptop',
  harnesses: ['claude-code'],
  connected: true,
  revokedAt: null,
  registeredAt: '2026-08-20T09:00:00.000Z',
  lastSeenAt: '2026-08-29T12:00:00.000Z',
  currentRun: null,
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/runners']}>
      <Routes>
        <Route path="/w/:slug/runners" element={<Runners />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Runners', () => {
  beforeEach(() => {
    failing.mockReturnValue(false);
    refetch.mockClear();
  });

  it('holds the shape of a runner while they load, keeping what never changes', () => {
    fleet.mockReturnValue(undefined);

    renderPage();

    expect(
      screen.getByRole('status', { name: 'Loading the runners' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Enrolled' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'New runner' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No runner has registered/),
    ).not.toBeInTheDocument();
  });

  it('says the runners could not be loaded, and tries again when asked', async () => {
    const person = userEvent.setup();
    fleet.mockReturnValue(undefined);
    failing.mockReturnValue(true);

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Runners could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No runner has registered/),
    ).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('says what each runner can run, not only that it is there', () => {
    fleet.mockReturnValue([runner()]);

    renderPage();

    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
  });

  it('shows no harnesses where a runner reported none', () => {
    fleet.mockReturnValue([runner({ harnesses: [] })]);

    renderPage();

    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.queryByText('Claude Code')).not.toBeInTheDocument();
    expect(screen.queryByText(/Reported nothing/)).not.toBeInTheDocument();
  });

  it('marks each harness with its logo', () => {
    fleet.mockReturnValue([runner({ harnesses: ['claude-code'] })]);

    const { container } = renderPage();

    expect(
      container.querySelector('[data-harness="claude-code"]'),
    ).toBeInTheDocument();
  });

  it('names the first few harnesses and counts the rest', () => {
    fleet.mockReturnValue([
      runner({ harnesses: ['claude-code', 'other', 'third', 'fourth'] }),
    ]);

    renderPage();

    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Other Harness')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('says how each runner is standing', () => {
    fleet.mockReturnValue([
      runner(),
      runner({ id: 'runner_2', connected: false }),
    ]);

    renderPage();

    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(screen.getByText('Not answering')).toBeInTheDocument();
  });

  it('says when it was last heard from', () => {
    fleet.mockReturnValue([runner()]);

    renderPage();

    expect(screen.getByText(/Last seen/)).toBeInTheDocument();
  });

  it('falls back to when it was registered, having never answered', () => {
    fleet.mockReturnValue([runner({ lastSeenAt: null, connected: false })]);

    renderPage();

    expect(screen.getByText(/^Registered /)).toBeInTheDocument();
  });

  it('says so when nothing has registered', () => {
    fleet.mockReturnValue([]);

    renderPage();

    expect(screen.getByText(/No runner has registered/)).toBeInTheDocument();
  });

  it('offers to register one where none has', async () => {
    const person = userEvent.setup();
    fleet.mockReturnValue([]);

    renderPage();

    await person.click(
      screen.getByRole('button', { name: 'Register a new runner' }),
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('offers nothing to register once one has', () => {
    fleet.mockReturnValue([runner()]);

    renderPage();

    expect(
      screen.queryByRole('button', { name: 'Register a new runner' }),
    ).not.toBeInTheDocument();
  });
});
