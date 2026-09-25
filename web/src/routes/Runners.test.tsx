import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Runners } from '@/routes/Runners';

const fleet = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useRunners', () => ({
  runnerKeys: {
    all: ['runners'],
    forWorkspace: (slug?: string) => ['runners', slug ?? null],
  },
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

const host = (over: Record<string, unknown> = {}) => ({
  id: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
  name: 'build-box-1',
  through: { kind: 'pool', key: 'build-farm' },
  release: 'v1.4.0',
  executor: 'Docker Engine 27.3.1 (linux/amd64)',
  capacity: 4,
  running: [],
  harnesses: ['claude-code'],
  firstSeenAt: '2026-08-20T09:00:00.000Z',
  lastSeenAt: '2026-08-29T12:00:00.000Z',
  answering: true,
  runs: [],
  ...over,
});

const provisioned = (over: Record<string, unknown> = {}) => ({
  id: 'runner_cloud_1',
  through: { kind: 'pool', key: 'ephemeral' },
  hostId: null,
  harnesses: ['claude-code'],
  startedAt: '2026-08-29T12:00:00.000Z',
  lastSeenAt: '2026-08-29T12:00:00.000Z',
  currentRun: { id: 'run_1', state: 'running' },
  ...over,
});

const holding = (hosts: unknown[], runners: unknown[] = []) =>
  fleet.mockReturnValue({ hosts, provisioned: runners });

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

  it('holds the shape of a host while they load, keeping what never changes', () => {
    fleet.mockReturnValue(undefined);

    renderPage();

    expect(
      screen.getByRole('status', { name: 'Loading the hosts' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hosts' })).toBeInTheDocument();
    expect(screen.queryByText(/No host is serving/)).not.toBeInTheDocument();
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
    expect(screen.queryByText(/No host is serving/)).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('says what each host can run, and which way in it serves', () => {
    holding([host()]);

    renderPage();

    expect(screen.getByText('build-box-1')).toBeInTheDocument();
    expect(screen.getByText('Pool build-farm')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
  });

  it('names a host serving a trust by the trust', () => {
    holding([host({ through: { kind: 'trust', key: 'production' } })]);

    renderPage();

    expect(screen.getByText('Trust production')).toBeInTheDocument();
  });

  it('names the first few harnesses and counts the rest', () => {
    holding([host({ harnesses: ['claude-code', 'other', 'third', 'fourth'] })]);

    renderPage();

    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Other Harness')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('says how busy each host is, and which one stopped answering', () => {
    holding([
      host({ running: ['runner_1', 'runner_2'] }),
      host({ id: 'second-host-id', name: 'idle-box' }),
      host({ id: 'third-host-id', name: 'gone-box', answering: false }),
    ]);

    renderPage();

    expect(screen.getByText('Running 2 of 4')).toBeInTheDocument();
    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(screen.getByText('Not answering')).toBeInTheDocument();
  });

  it('says how long a host has been up, or when it was last heard from', () => {
    holding([
      host(),
      host({ id: 'third-host-id', name: 'gone-box', answering: false }),
    ]);

    renderPage();

    expect(screen.getByText(/^Up since/)).toBeInTheDocument();
    expect(screen.getByText(/^Last seen/)).toBeInTheDocument();
  });

  it('shows how to install a host when none serves the workspace', () => {
    holding([]);

    renderPage();

    expect(screen.getByText(/No host is serving/)).toBeInTheDocument();
    expect(screen.getByText(/install\.sh/)).toBeInTheDocument();
  });

  it('lists runners a push pool provisioned, apart from hosts', () => {
    holding([host()], [provisioned()]);

    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Provisioned by a pool' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pool ephemeral')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('leaves the provisioned section out when there are none', () => {
    holding([host()]);

    renderPage();

    expect(
      screen.queryByRole('heading', { name: 'Provisioned by a pool' }),
    ).not.toBeInTheDocument();
  });
});
