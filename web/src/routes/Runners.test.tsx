import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Runners } from '@/routes/Runners';

const fleet = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();
const role = vi.fn();

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

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({ data: { id: 'workspace_acme', role: role() } }),
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [
      { id: 'claude-code', name: 'Claude Code' },
      { id: 'other', name: 'Other Harness' },
    ],
  }),
}));

const DIGEST =
  'a3f9c2e17b4d58f6e0c1a2b3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b';

const image = (over: Record<string, unknown> = {}) => ({
  image: 'ghcr.io/usespotlightai/spotlight-runner:20260925-01',
  digest: `ghcr.io/usespotlightai/spotlight-runner@sha256:${DIGEST}`,
  usual: true,
  release: '20260925-01',
  harnesses: [{ id: 'claude-code', version: '2.1.270' }],
  refused: null,
  ...over,
});

const host = (over: Record<string, unknown> = {}) => ({
  id: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
  name: 'build-box-1',
  through: { kind: 'pool', key: 'build-farm' },
  release: 'v1.4.0',
  executor: 'Docker Engine 27.3.1 (linux/amd64)',
  capacity: 4,
  running: [],
  images: [image()],
  firstSeenAt: '2026-08-20T09:00:00.000Z',
  upSince: '2026-08-29T09:00:00.000Z',
  lastSeenAt: '2026-08-29T12:00:00.000Z',
  answering: true,
  runs: [],
  ...over,
});

const provisioned = (over: Record<string, unknown> = {}) => ({
  id: 'runner_cloud_1',
  through: { kind: 'pool', key: 'ephemeral' },
  hostId: null,
  image: null,
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
    <MemoryRouter initialEntries={['/w/acme/settings/runners']}>
      <Routes>
        <Route path="/w/:slug/settings/runners" element={<Runners />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Runners', () => {
  beforeEach(() => {
    localStorage.clear();
    failing.mockReturnValue(false);
    refetch.mockClear();
    role.mockReturnValue('owner');
  });

  it('holds the shape of a host while they load', () => {
    fleet.mockReturnValue(undefined);

    renderPage();

    expect(
      screen.getByRole('status', { name: 'Loading the hosts' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.queryByText(/No hosts yet/)).not.toBeInTheDocument();
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
    expect(screen.queryByText(/No hosts yet/)).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('says what each host can run, and which way in it serves', () => {
    holding([host()]);

    renderPage();

    expect(screen.getByText('build-box-1')).toBeInTheDocument();
    expect(screen.getByText('Pool build-farm')).toBeInTheDocument();
    expect(screen.getByText('Claude Code 2.1.270')).toBeInTheDocument();
  });

  it('names a host’s default image, and counts the others', () => {
    holding([
      host({
        images: [
          image({ usual: false, image: 'ghcr.io/acme/api-runner:main' }),
          image(),
        ],
      }),
    ]);

    renderPage();

    const named = screen.getByText('spotlight-runner:20260925-01');
    expect(named).toHaveAttribute(
      'title',
      expect.stringContaining('ghcr.io/acme/api-runner:main'),
    );
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('says a host refuses an image, and why', () => {
    holding([
      host({
        images: [
          image(),
          image({
            image: 'ghcr.io/acme/legacy-runner:2025',
            usual: false,
            release: null,
            harnesses: [{ id: 'other', version: null }],
            refused:
              'Its runner reports no release, so it is older than the 20260925-01 this control plane needs',
          }),
        ],
      }),
    ]);

    renderPage();

    expect(screen.getByText('1 refused')).toHaveAttribute(
      'title',
      expect.stringContaining(
        'Refused: its runner reports no release, so it is older than the 20260925-01 this control plane needs',
      ),
    );
    expect(screen.queryByText('Other Harness')).not.toBeInTheDocument();
  });

  it('names a host serving a trust by the trust', () => {
    holding([host({ through: { kind: 'trust', key: 'production' } })]);

    renderPage();

    expect(screen.getByText('Trust production')).toBeInTheDocument();
  });

  it('names every harness a host serves, once', () => {
    holding([
      host({
        images: [
          image({
            harnesses: [
              { id: 'claude-code', version: null },
              { id: 'other', version: null },
            ],
          }),
          image({
            image: 'ghcr.io/acme/api-runner:main',
            usual: false,
            harnesses: [
              { id: 'claude-code', version: null },
              { id: 'third', version: null },
            ],
          }),
        ],
      }),
    ]);

    renderPage();

    expect(screen.getAllByText('Claude Code')).toHaveLength(1);
    expect(screen.getByText('Other Harness')).toBeInTheDocument();
    expect(screen.getByText('third')).toBeInTheDocument();
  });

  it('says how busy each host is, and which one stopped answering', () => {
    holding([
      host({ running: ['runner_1', 'runner_2'] }),
      host({ id: 'second-host-id', name: 'idle-box' }),
      host({ id: 'third-host-id', name: 'gone-box', answering: false }),
    ]);

    renderPage();

    const hosts = within(screen.getByRole('region', { name: 'Hosts' }));
    expect(hosts.getByText('Running 2 of 4')).toBeInTheDocument();
    expect(hosts.getByText('Idle')).toBeInTheDocument();
    expect(hosts.getByText('Not answering')).toBeInTheDocument();
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

  it('offers to add the first host on its own page', () => {
    holding([]);

    renderPage();

    expect(screen.getByText(/No hosts yet/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Add the first host' }),
    ).toHaveAttribute('href', '/w/acme/settings/runners/new');
  });

  it('tells a member who can add a computer, offering no pool', () => {
    holding([]);
    role.mockReturnValue('member');

    renderPage();

    expect(screen.getByText(/A workspace owner or admin/)).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Add the first host' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Add a host' }),
    ).not.toBeInTheDocument();
  });

  it('offers to add another host on its own page', () => {
    holding([host()]);

    renderPage();

    expect(screen.getByRole('link', { name: 'Add a host' })).toHaveAttribute(
      'href',
      '/w/acme/settings/runners/new',
    );
  });

  it('lists runners a push pool provisioned, apart from hosts', () => {
    holding([host()], [provisioned()]);

    renderPage();

    const runners = within(
      screen.getByRole('region', { name: 'Provisioned by a pool' }),
    );
    expect(runners.getByText('Pool ephemeral')).toBeInTheDocument();
    expect(runners.getByText('Running')).toBeInTheDocument();
  });

  it('leaves the provisioned section out when there are none', () => {
    holding([host()]);

    renderPage();

    expect(
      screen.queryByRole('region', { name: 'Provisioned by a pool' }),
    ).not.toBeInTheDocument();
  });

  it('shows only the hosts in the chosen filter, and remembers it', async () => {
    const person = userEvent.setup();
    holding(
      [
        host({ running: ['runner_1'] }),
        host({ id: 'second-host-id', name: 'idle-box' }),
        host({ id: 'third-host-id', name: 'gone-box', answering: false }),
      ],
      [provisioned()],
    );

    renderPage();

    await person.click(screen.getByRole('button', { name: 'Idle' }));

    expect(screen.getByText('idle-box')).toBeInTheDocument();
    expect(screen.queryByText('build-box-1')).not.toBeInTheDocument();
    expect(screen.queryByText('gone-box')).not.toBeInTheDocument();
    expect(screen.queryByText('Pool ephemeral')).not.toBeInTheDocument();
    expect(localStorage.getItem('spotlight.runner-filter')).toBe('idle');

    await person.click(screen.getByRole('button', { name: 'Running' }));

    expect(screen.getByText('build-box-1')).toBeInTheDocument();
    expect(screen.getByText('Pool ephemeral')).toBeInTheDocument();
    expect(screen.queryByText('idle-box')).not.toBeInTheDocument();
  });

  it('says when no host is in the chosen filter', async () => {
    const person = userEvent.setup();
    holding([host()]);

    renderPage();

    await person.click(screen.getByRole('button', { name: 'Not answering' }));

    expect(screen.getByText('Every host is answering.')).toBeInTheDocument();
  });
});
