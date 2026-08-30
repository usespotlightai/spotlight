import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Runners } from '@/routes/Runners';

const fleet = vi.fn();

vi.mock('@/hooks/api/useRunners', () => ({
  runnerKeys: { all: ['runners'] },
  useRunners: () => ({ data: fleet(), isPending: false }),
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
  it('says what each runner can run, not only that it is there', () => {
    fleet.mockReturnValue([runner()]);

    renderPage();

    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
  });

  // A runner that has connected and found nothing is worth telling apart from
  // one that has never spoken.
  it('says when a runner reported nothing it can run', () => {
    fleet.mockReturnValue([runner({ harnesses: [] })]);

    renderPage();

    expect(screen.getByText(/Reported nothing it can run/)).toBeInTheDocument();
  });

  // A machine with everything installed should not push the row wide with a
  // list nobody reads to the end.
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
});
