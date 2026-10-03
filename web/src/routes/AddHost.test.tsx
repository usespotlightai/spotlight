import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunnerPoolNameTakenError } from '@/hooks/api/useCreateRunnerPool';
import { AddHost } from '@/routes/AddHost';

const role = vi.fn();
const creating = vi.fn();
const create = vi.fn();
const fleet = vi.fn();
const pools = vi.fn();

vi.mock('@/hooks/api/useRunnerPools', () => ({
  useRunnerPools: () => ({ data: pools(), isPending: false }),
}));

vi.mock('@/hooks/api/useRunners', () => ({
  useRunners: () => ({ data: fleet() }),
}));

const host = (over: Record<string, unknown> = {}) => ({
  id: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
  name: 'leons-mac',
  through: { kind: 'pool', key: 'my-computer' },
  answering: true,
  running: [],
  ...over,
});

const holding = (...hosts: unknown[]) =>
  fleet.mockReturnValue({ hosts, provisioned: [] });

const poolCreated = () =>
  creating.mockReturnValue({
    data: { key: 'my-computer', token: 'spt_pool_secret' },
  });

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

const folded = (step: string): boolean =>
  screen
    .getByRole('heading', { name: step })
    .parentElement?.querySelector('[inert]') != null;

const page = () => (
  <MemoryRouter initialEntries={['/w/acme/settings/runners/new']}>
    <Routes>
      <Route path="/w/:slug/settings/runners" element={<p>The runners</p>} />
      <Route path="/w/:slug/settings/runners/new" element={<AddHost />} />
    </Routes>
  </MemoryRouter>
);

const renderPage = () => render(page());

describe('AddHost', () => {
  beforeEach(() => {
    vi.useRealTimers();
    role.mockReturnValue('owner');
    creating.mockReturnValue({});
    create.mockClear();
    holding();
    pools.mockReturnValue([]);
  });

  it('leads back to the runners', () => {
    renderPage();

    const links = screen.getAllByRole('link', { name: 'Runners' });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/w/acme/settings/runners');
    }
  });

  it('sends a member back to the runners', () => {
    role.mockReturnValue('member');

    renderPage();

    expect(screen.getByText('The runners')).toBeInTheDocument();
  });

  it('creates a pool with the name given', async () => {
    const person = userEvent.setup();

    renderPage();

    expect(screen.getByLabelText('Pool name')).toHaveValue('my-computer-1');

    await person.click(screen.getByRole('button', { name: 'Create pool' }));

    expect(create).toHaveBeenCalledWith('my-computer-1');
  });

  it('suggests the first numbered name no pool has yet', () => {
    pools.mockReturnValue([
      { key: 'my-computer-1' },
      { key: 'my-computer-2' },
      { key: 'my-computer-4' },
    ]);

    renderPage();

    expect(screen.getByLabelText('Pool name')).toHaveValue('my-computer-3');
  });

  it('keeps a pool name to lowercase words joined by dashes', async () => {
    const person = userEvent.setup();

    renderPage();

    const name = screen.getByLabelText('Pool name');
    await person.clear(name);
    await person.type(name, 'Build Box 2');
    await person.click(screen.getByRole('button', { name: 'Create pool' }));

    expect(create).toHaveBeenCalledWith('build-box-2');
  });

  it('says a taken pool name is taken, and asks for another', () => {
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
    creating.mockReturnValue({
      error: new Error('You may not do that to the runner-pool'),
    });

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'You may not do that to the runner-pool',
    );
  });

  it('gives the install command with the new pool’s token, once', () => {
    poolCreated();

    renderPage();

    expect(document.body).toHaveTextContent('SPOTLIGHT_TOKEN=spt_pool_secret');
    expect(
      screen.getByText('Add the machine to the my-computer pool'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy command' })).toHaveFocus();
  });

  it('says what each step is for', () => {
    renderPage();

    expect(
      screen.getByText(/A pool is a group of hosts that authenticate/),
    ).toBeInTheDocument();
    expect(screen.getByText(/shown only this once/)).toBeInTheDocument();
    expect(
      screen.getByText(/The host shows here as soon as it reports/),
    ).toBeInTheDocument();
  });

  it('opens only the first step before a pool exists', () => {
    renderPage();

    expect(folded('Create a pool')).toBe(false);
    expect(folded('Add the machine to the pool')).toBe(true);
    expect(folded('Wait for the host to connect')).toBe(true);
  });

  it('folds the pool step away once the pool exists, keeping its field', () => {
    poolCreated();

    renderPage();

    expect(folded('Create a pool')).toBe(true);
    expect(screen.getByLabelText('Pool name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create pool' })).toBeDisabled();
    expect(folded('Add the machine to the my-computer pool')).toBe(false);
    expect(folded('Wait for the host to connect')).toBe(true);
  });

  it('moves on to waiting two seconds after the command is copied', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const person = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    poolCreated();

    renderPage();

    await person.click(screen.getByRole('button', { name: 'Copy command' }));

    expect(folded('Add the machine to the my-computer pool')).toBe(false);

    act(() => vi.advanceTimersByTime(1_900));
    expect(folded('Add the machine to the my-computer pool')).toBe(false);

    act(() => vi.advanceTimersByTime(100));
    expect(folded('Add the machine to the my-computer pool')).toBe(true);
    expect(folded('Wait for the host to connect')).toBe(false);
  });

  it('opens a folded step again from its title, folding the rest', async () => {
    const person = userEvent.setup();
    poolCreated();

    renderPage();

    const pool = screen.getByRole('button', { name: 'Create a pool' });
    expect(pool).toHaveAttribute('aria-expanded', 'false');

    await person.click(pool);

    expect(folded('Create a pool')).toBe(false);
    expect(pool).toHaveAttribute('aria-expanded', 'true');
    expect(folded('Add the machine to the my-computer pool')).toBe(true);

    await person.click(
      screen.getByRole('button', {
        name: 'Add the machine to the my-computer pool',
      }),
    );

    expect(folded('Create a pool')).toBe(true);
    expect(folded('Add the machine to the my-computer pool')).toBe(false);
  });

  it('opens the step the page moves on to, even after one was picked', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const person = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    poolCreated();

    renderPage();

    await person.click(screen.getByRole('button', { name: 'Copy command' }));
    await person.click(screen.getByRole('button', { name: 'Create a pool' }));
    expect(folded('Create a pool')).toBe(false);

    act(() => vi.advanceTimersByTime(2_000));

    expect(folded('Create a pool')).toBe(true);
    expect(folded('Wait for the host to connect')).toBe(false);
  });

  it('offers no title to click before the pool exists', () => {
    renderPage();

    expect(
      screen.queryByRole('button', { name: 'Create a pool' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add the machine to the pool' }),
    ).not.toBeInTheDocument();
  });

  it('waits for a host in the new pool to connect', () => {
    poolCreated();
    holding(
      host({ through: { kind: 'pool', key: 'build-farm' } }),
      host({ id: 'second', name: 'asleep', answering: false }),
    );

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent(
      'Waiting for a host in the my-computer pool',
    );
    expect(screen.queryByText('The runners')).not.toBeInTheDocument();
  });

  it('goes to the runners once a host of the new pool connects', () => {
    poolCreated();
    holding(host());

    renderPage();

    expect(screen.getByText('The runners')).toBeInTheDocument();
  });
});
