import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Runners } from '@/routes/Runners';

const fleet = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();
const role = vi.fn();

const pools = vi.fn(() => [] as unknown[]);

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

vi.mock('@/hooks/api/useRunnerPools', () => ({
  useRunnerPools: () => ({ data: pools() }),
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
  isDefault: true,
  release: '20260925-01',
  harnesses: [{ id: 'claude-code', version: '2.1.270' }],
  unavailableReason: null,
  ...over,
});

const host = (over: Record<string, unknown> = {}) => ({
  id: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
  name: 'build-box-1',
  source: { kind: 'pool', key: 'build-farm' },
  release: 'v1.4.0',
  containerRuntime: 'Docker Engine 27.3.1 (linux/amd64)',
  capacity: 4,
  running: [],
  images: [image()],
  firstHeartbeatAt: '2026-08-20T09:00:00.000Z',
  onlineSince: '2026-08-29T09:00:00.000Z',
  lastHeartbeatAt: '2026-08-29T12:00:00.000Z',
  online: true,
  runners: [],
  ...over,
});

const pushPool = (over: Record<string, unknown> = {}) => ({
  source: { kind: 'pool', key: 'ephemeral' },
  runners: [provisioned(over)],
});

const LEASED_RUN = {
  id: 'run_1',
  state: 'running',
  kind: 'task',
  teamId: 'team_1',
  readable: true,
  title: 'Drain the stuck retry queues',
};

const provisioned = (over: Record<string, unknown> = {}) => ({
  id: 'runner_cloud_1',
  source: { kind: 'pool', key: 'ephemeral' },
  hostId: null,
  image: null,
  harnesses: ['claude-code'],
  startedAt: '2026-08-29T12:00:00.000Z',
  lastHeartbeatAt: '2026-08-29T12:00:00.000Z',
  currentRun: LEASED_RUN,
  ...over,
});

const listing = (hosts: unknown[], pools: unknown[] = []) =>
  fleet.mockReturnValue({ hosts, pools });

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

  it('keeps the shape of a host while they load', () => {
    fleet.mockReturnValue(undefined);

    renderPage();

    expect(
      screen.getByRole('status', { name: 'Loading the hosts' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.queryByText(/No hosts yet/)).not.toBeInTheDocument();
  });

  it('says the runners could not be loaded, and tries again on request', async () => {
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
    listing([host()]);

    renderPage();

    expect(screen.getByText('build-box-1')).toBeInTheDocument();
    expect(screen.getByText('Pool build-farm')).toBeInTheDocument();
    expect(screen.getByText('Claude Code 2.1.270')).toBeInTheDocument();
  });

  it('names a host’s default image, and counts the others', () => {
    listing([
      host({
        images: [
          image({ isDefault: false, image: 'ghcr.io/acme/api-runner:main' }),
          image(),
        ],
      }),
    ]);

    renderPage();

    const named = screen.getByText('spotlight-runner:20260925-01');
    expect(named.parentElement).toHaveAttribute(
      'title',
      expect.stringContaining('ghcr.io/acme/api-runner:main'),
    );
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('says a host cannot use an image, and why', async () => {
    listing([
      host({
        images: [
          image(),
          image({
            image: 'ghcr.io/acme/legacy-runner:2025',
            isDefault: false,
            release: null,
            harnesses: [{ id: 'other', version: null }],
            unavailableReason:
              'Runner doesn’t report its release number. Minimum version required: 20260925-01',
          }),
        ],
      }),
    ]);

    renderPage();

    await userEvent.hover(screen.getByText('1 unavailable'));

    expect(
      await screen.findByText(
        'Runner doesn’t report its release number. Minimum version required: 20260925-01',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Other Harness')).not.toBeInTheDocument();
  });

  it('names a host serving a trust by the trust', () => {
    listing([host({ source: { kind: 'trust', key: 'production' } })]);

    renderPage();

    expect(screen.getByText('Trust production')).toBeInTheDocument();
  });

  it('names every harness a host serves, once', () => {
    listing([
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
            isDefault: false,
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

  it('says how busy each host is, and which one is offline', () => {
    listing([
      host({ running: ['runner_1', 'runner_2'] }),
      host({ id: 'second-host-id', name: 'idle-box' }),
      host({ id: 'third-host-id', name: 'gone-box', online: false }),
    ]);

    renderPage();

    const hosts = within(
      screen.getByRole('region', { name: 'Hosts and push pools' }),
    );
    expect(hosts.getByText('Running 2 of 4')).toBeInTheDocument();
    expect(hosts.getByText('Idle')).toBeInTheDocument();
    expect(hosts.getByText('Offline')).toBeInTheDocument();
  });

  it('says when a host came online, or when it sent its last heartbeat', () => {
    listing([
      host(),
      host({ id: 'third-host-id', name: 'gone-box', online: false }),
    ]);

    renderPage();

    expect(screen.getByText(/^Online since/)).toBeInTheDocument();
    expect(screen.getByText(/^Last heartbeat/)).toBeInTheDocument();
  });

  it('offers to add the first host on its own page', () => {
    listing([]);

    renderPage();

    expect(screen.getByText(/No hosts yet/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Add the first host' }),
    ).toHaveAttribute('href', '/w/acme/settings/runners/new');
  });

  it('tells a member who can add a computer, offering no pool', () => {
    listing([]);
    role.mockReturnValue('member');

    renderPage();

    expect(
      screen.getByText(/Only workspace owners and admins/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Add the first host' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Add a host' }),
    ).not.toBeInTheDocument();
  });

  it('offers to add another host on its own page', () => {
    listing([host()]);

    renderPage();

    expect(screen.getByRole('link', { name: 'Add a host' })).toHaveAttribute(
      'href',
      '/w/acme/settings/runners/new',
    );
  });

  it('nests each runner under its host, linking to the run it works on', () => {
    listing([
      host({
        running: ['runner_1'],
        runners: [
          provisioned({
            id: 'runner_1',
            hostId: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
            image: 'ghcr.io/usespotlightai/spotlight-runner:20260925-01',
          }),
        ],
      }),
    ]);

    renderPage();

    const nested = within(
      screen.getByRole('list', { name: 'Runners on build-box-1' }),
    );
    expect(
      nested.getByRole('link', { name: 'Drain the stuck retry queues' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_1');
  });

  it('hides the run of a team the viewer cannot read behind a blurred stand-in, saying why', () => {
    listing([
      host({
        running: ['runner_1'],
        runners: [
          provisioned({
            id: 'runner_1',
            hostId: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
            currentRun: { ...LEASED_RUN, readable: false, title: null },
          }),
        ],
      }),
    ]);

    renderPage();

    const nested = within(
      screen.getByRole('list', { name: 'Runners on build-box-1' }),
    );
    expect(
      nested.getByText(
        'Title hidden. This run belongs to a team you’re not on.',
      ),
    ).toBeInTheDocument();
    expect(nested.queryByRole('link')).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="hidden-run"] [aria-hidden]'),
    ).toHaveClass('blur-[3px]');
  });

  it('nests the runners a push pool started under that pool, naming runs it cannot open', () => {
    listing(
      [host()],
      [
        pushPool({
          currentRun: { ...LEASED_RUN, kind: 'search', title: null },
        }),
      ],
    );

    renderPage();

    expect(screen.getByText('ephemeral')).toBeInTheDocument();
    expect(screen.getByText('Push pool')).toBeInTheDocument();
    const nested = within(
      screen.getByRole('list', { name: 'Runners on ephemeral' }),
    );
    expect(nested.getByText('A search run')).toBeInTheDocument();
    expect(nested.queryByRole('link')).not.toBeInTheDocument();
  });

  it('says when a push pool goes out through an egress', () => {
    pools.mockReturnValueOnce([
      { key: 'ephemeral', provision: { egress: 'spotlight' } },
    ]);
    listing([host()], [pushPool()]);

    renderPage();

    expect(screen.getByText('Push pool · egress')).toBeInTheDocument();
  });

  it('shows only the hosts in the chosen filter, and remembers it', async () => {
    const person = userEvent.setup();
    listing(
      [
        host({ running: ['runner_1'] }),
        host({ id: 'second-host-id', name: 'idle-box' }),
        host({ id: 'third-host-id', name: 'gone-box', online: false }),
      ],
      [pushPool()],
    );

    renderPage();

    await person.click(screen.getByRole('button', { name: 'Idle' }));

    expect(screen.getByText('idle-box')).toBeInTheDocument();
    expect(screen.queryByText('build-box-1')).not.toBeInTheDocument();
    expect(screen.queryByText('gone-box')).not.toBeInTheDocument();
    expect(screen.queryByText('ephemeral')).not.toBeInTheDocument();
    expect(localStorage.getItem('spotlight.runner-filter')).toBe('idle');

    await person.click(screen.getByRole('button', { name: 'Running' }));

    expect(screen.getByText('build-box-1')).toBeInTheDocument();
    expect(screen.getByText('ephemeral')).toBeInTheDocument();
    expect(screen.queryByText('idle-box')).not.toBeInTheDocument();
  });

  it('says when no host is in the chosen filter', async () => {
    const person = userEvent.setup();
    listing([host()]);

    renderPage();

    await person.click(screen.getByRole('button', { name: 'Offline' }));

    expect(screen.getByText('All hosts are online.')).toBeInTheDocument();
  });
});
