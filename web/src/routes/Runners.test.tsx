import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunnerPoolNameTakenError } from '@/hooks/api/useCreateRunnerPool';
import { Runners } from '@/routes/Runners';

const fleet = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();
const role = vi.fn();
const creating = vi.fn();
const create = vi.fn();

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

vi.mock('@/hooks/api/useCreateRunnerPool', async (actual) => ({
  ...(await actual<typeof import('@/hooks/api/useCreateRunnerPool')>()),
  useCreateRunnerPool: () => ({
    mutate: create,
    reset: vi.fn(),
    isPending: false,
    error: null,
    ...creating(),
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
    role.mockReturnValue('owner');
    creating.mockReturnValue({});
    create.mockClear();
  });

  it('holds the shape of a host while they load, keeping what never changes', () => {
    fleet.mockReturnValue(undefined);

    renderPage();

    expect(
      screen.getByRole('status', { name: 'Loading the hosts' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hosts' })).toBeInTheDocument();
    expect(screen.queryByText(/No host serves/)).not.toBeInTheDocument();
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
    expect(screen.queryByText(/No host serves/)).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('says what each host can run, and which way in it serves', () => {
    holding([host()]);

    renderPage();

    expect(screen.getByText('build-box-1')).toBeInTheDocument();
    expect(screen.getByText('Pool build-farm')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('2.1.270')).toBeInTheDocument();
  });

  it('names each image a host serves, its default, and the runner and digest in it', () => {
    holding([
      host({
        images: [
          image(),
          image({
            image: 'ghcr.io/acme/api-runner:main',
            digest: `ghcr.io/acme/api-runner@sha256:${DIGEST}`,
            usual: false,
          }),
        ],
      }),
    ]);

    renderPage();

    const images = screen.getByRole('list', { name: 'Runner images' });
    expect(images).toHaveTextContent(
      'ghcr.io/usespotlightai/spotlight-runner:20260925-01',
    );
    expect(images).toHaveTextContent('ghcr.io/acme/api-runner:main');
    expect(screen.getAllByText('Default')).toHaveLength(1);
    expect(screen.getAllByText('Runner 20260925-01')).toHaveLength(2);
    expect(screen.getAllByText('sha256:a3f9c2e17b4d')).toHaveLength(2);
  });

  it('says why a host refuses an image', () => {
    holding([
      host({
        images: [
          image({
            image: 'ghcr.io/acme/legacy-runner:2025',
            usual: false,
            release: null,
            harnesses: [],
            refused:
              'Its runner reports no release, so it is older than the 20260925-01 this control plane needs',
          }),
        ],
      }),
    ]);

    renderPage();

    expect(
      screen.getByText(
        'Refused: its runner reports no release, so it is older than the 20260925-01 this control plane needs',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Claude Code')).not.toBeInTheDocument();
  });

  it('names a host serving a trust by the trust', () => {
    holding([host({ through: { kind: 'trust', key: 'production' } })]);

    renderPage();

    expect(screen.getByText('Trust production')).toBeInTheDocument();
  });

  it('names the first few harnesses and counts the rest', () => {
    holding([
      host({
        images: [
          image({
            harnesses: [
              { id: 'claude-code', version: null },
              { id: 'other', version: null },
              { id: 'third', version: null },
              { id: 'fourth', version: null },
            ],
          }),
        ],
      }),
    ]);

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

  it('offers to create a pool when no host serves the workspace', async () => {
    const person = userEvent.setup();
    holding([]);

    renderPage();

    expect(screen.getByText(/No host serves/)).toBeInTheDocument();
    expect(screen.getByLabelText('Pool name')).toHaveValue('my-computer');

    await person.click(screen.getByRole('button', { name: 'Create pool' }));

    expect(create).toHaveBeenCalledWith('my-computer');
  });

  it('keeps a pool name to lowercase words joined by dashes', async () => {
    const person = userEvent.setup();
    holding([]);

    renderPage();

    const name = screen.getByLabelText('Pool name');
    await person.clear(name);
    await person.type(name, 'Build Box 2');
    await person.click(screen.getByRole('button', { name: 'Create pool' }));

    expect(create).toHaveBeenCalledWith('build-box-2');
  });

  it('still shows the install command for a token someone already has', () => {
    holding([]);

    renderPage();

    expect(
      screen.getByText(/SPOTLIGHT_TOKEN=<pool token>/),
    ).toBeInTheDocument();
  });

  it('says a taken pool name is taken, and asks for another', () => {
    holding([]);
    creating.mockReturnValue({
      error: new RunnerPoolNameTakenError('my-computer'),
    });

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'A pool named my-computer already exists. Choose another name.',
    );
    expect(screen.getByLabelText('Pool name')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('says why a pool could not be created otherwise', () => {
    holding([]);
    creating.mockReturnValue({
      error: new Error('You may not do that to the runner-pool'),
    });

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'You may not do that to the runner-pool',
    );
  });

  it('gives the install command with the new pool’s token, once', () => {
    holding([]);
    creating.mockReturnValue({
      data: { key: 'my-computer', token: 'spt_pool_secret' },
    });

    renderPage();

    expect(
      screen.getByText(/SPOTLIGHT_TOKEN=spt_pool_secret/),
    ).toBeInTheDocument();
    expect(screen.getByText(/shown only this once/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy command' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Pool name')).not.toBeInTheDocument();
  });

  it('tells a member who can add a computer, offering no pool', () => {
    holding([]);
    role.mockReturnValue('member');

    renderPage();

    expect(screen.getByText(/An owner or admin/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create pool' }),
    ).not.toBeInTheDocument();
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
