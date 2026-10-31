import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettingUp } from '@/hooks/api/useSettingUp';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { Workspace } from '@/routes/Workspace';

vi.mock('@/hooks/api/useWorkspace', () => ({ useWorkspace: vi.fn() }));
vi.mock('@/hooks/api/useSettingUp', () => ({ useSettingUp: vi.fn() }));

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [{ id: 'line_1', name: 'Default', stations: [] }],
    isPending: false,
  }),
}));
vi.mock('@/hooks/api/useTasks', () => ({
  useTasks: () => ({ data: [], isPending: false }),
}));
vi.mock('@/hooks/useCommandSections', () => ({
  useCommandSections: () => [],
}));
vi.mock('@/hooks/api/useSignOut', () => ({
  useSignOut: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/api/useWorkspaces', () => ({
  useWorkspaces: () => ({ data: [], isPending: false }),
}));
vi.mock('@/hooks/api/useInbox', () => ({
  inboxKeys: { forWorkspace: () => ['inbox'] },
  useInbox: () => ({ data: [] }),
}));
const hosts = vi.fn();

vi.mock('@/hooks/api/useRunners', () => ({
  runnerKeys: {
    all: ['runners'],
    forWorkspace: (slug?: string) => ['runners', slug ?? null],
  },
  useRunners: () => ({
    isPending: false,
    errorUpdateCount: 0,
    data: { hosts: hosts(), pools: [] },
  }),
}));
vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: { user: { email: 'dev@example.com' } } }),
}));

const mockWorkspace = vi.mocked(useWorkspace);
const mockSettingUp = vi.mocked(useSettingUp);

const refetch = vi.fn();

const answered = (over: Record<string, unknown>) =>
  mockWorkspace.mockReturnValue({
    data: undefined,
    isPending: false,
    errorUpdateCount: 0,
    isFetching: false,
    refetch,
    ...over,
  } as never);

const loaded = (data: unknown) => answered({ data });

const acme = {
  id: 'ws_1',
  name: 'Acme Inc.',
  slug: 'acme-inc',
  role: 'owner',
  teams: [{ id: 'team_1', name: 'Platform' }],
};

const renderAt = (slug: string, rest = '') =>
  render(
    <MemoryRouter initialEntries={[`/w/${slug}${rest}`]}>
      <Routes>
        <Route path="/w/:slug" element={<Workspace />}>
          <Route index element={<p>section slot</p>} />
          <Route path="team/:teamId/runs" element={<p>runs slot</p>} />
          <Route path="settings/*" element={<p>settings slot</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mockWorkspace.mockReset();
  mockSettingUp.mockReturnValue(false);
  refetch.mockClear();
  hosts.mockReturnValue([
    { id: 'h1', name: 'one', online: true },
    { id: 'h2', name: 'two', online: true },
    { id: 'h3', name: 'three', online: false },
  ]);
});

describe('Workspace', () => {
  it('says the workspace is being set up, in place of the sidebar and page', () => {
    loaded(acme);
    mockSettingUp.mockReturnValue(true);

    renderAt('acme-inc');

    expect(
      screen.getByRole('heading', { name: 'Setting up your workspace…' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('section slot')).not.toBeInTheDocument();
    expect(mockSettingUp).toHaveBeenCalledWith('acme-inc', acme);
  });

  it('keeps the settings open while the workspace is being set up', () => {
    loaded(acme);
    mockSettingUp.mockReturnValue(true);

    renderAt('acme-inc', '/settings/runners');

    expect(screen.getByText('settings slot')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Setting up your workspace…' }),
    ).not.toBeInTheDocument();
  });

  it('names the workspace at that address in the sidebar', () => {
    loaded(acme);

    renderAt('acme-inc');

    expect(
      screen.getByRole('button', { name: /Acme Inc\./ }),
    ).toBeInTheDocument();
  });

  it('leads to the settings from the workspace menu, keeping runners and tokens out of the sidebar', async () => {
    const person = userEvent.setup();
    loaded(acme);

    renderAt('acme-inc');

    expect(
      screen.queryByRole('link', { name: 'Settings' }),
    ).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: /Acme Inc\./ }));

    expect(
      await screen.findByRole('menuitem', { name: 'Settings' }),
    ).toHaveAttribute('href', '/w/acme-inc/settings');
    expect(
      screen.queryByRole('link', { name: /Runners/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'API access' }),
    ).not.toBeInTheDocument();
  });

  it('swaps the sidebar for the settings’ own while in settings', () => {
    loaded(acme);

    renderAt('acme-inc', '/settings/general');

    const nav = screen.getByRole('navigation', { name: 'Settings' });

    expect(screen.getByText('settings slot')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Inbox/ }),
    ).not.toBeInTheDocument();
    expect(
      within(nav).getByRole('heading', { name: 'Workspace' }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole('heading', { name: 'Platform' }),
    ).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Skills' })).toHaveAttribute(
      'href',
      '/w/acme-inc/settings/team/team_1/skills',
    );
  });

  it('offers the members and tokens to an owner or admin of the workspace', () => {
    loaded({ ...acme, role: 'admin' });

    renderAt('acme-inc', '/settings/general');

    expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute(
      'href',
      '/w/acme-inc/settings/members',
    );
    expect(screen.getByRole('link', { name: 'API access' })).toHaveAttribute(
      'href',
      '/w/acme-inc/settings/api-access',
    );
  });

  it('offers a member neither the members nor the tokens', () => {
    loaded({ ...acme, role: 'member' });

    renderAt('acme-inc', '/settings/general');

    expect(
      screen.queryByRole('link', { name: 'Members' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'API access' }),
    ).not.toBeInTheDocument();
  });

  it('leads back from the settings to where the person was', async () => {
    const person = userEvent.setup();
    loaded(acme);

    renderAt('acme-inc', '/team/team_1/runs?filter=waiting');

    await person.click(screen.getByRole('button', { name: /Acme Inc\./ }));
    await person.click(
      await screen.findByRole('menuitem', { name: 'Settings' }),
    );

    expect(screen.getByRole('link', { name: 'Back to app' })).toHaveAttribute(
      'href',
      '/w/acme-inc/team/team_1/runs?filter=waiting',
    );
  });

  it('leads back to the workspace when the settings were opened directly', () => {
    loaded(acme);

    renderAt('acme-inc', '/settings/general');

    expect(screen.getByRole('link', { name: 'Back to app' })).toHaveAttribute(
      'href',
      '/w/acme-inc',
    );
  });

  it('frames the section at that address', () => {
    loaded(acme);

    renderAt('acme-inc');

    expect(screen.getByText('section slot')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Default' })).toHaveAttribute(
      'href',
      '/w/acme-inc/team/team_1/lines/line_1',
    );
  });

  it('requests the workspace by the slug in the address', () => {
    loaded(acme);

    renderAt('acme-inc');

    expect(mockWorkspace).toHaveBeenCalledWith('acme-inc');
  });

  it('says so when the workspace is not the caller’s to read', () => {
    loaded(null);

    renderAt('someone-elses');

    expect(
      screen.getByRole('heading', { name: 'Workspace not found' }),
    ).toBeInTheDocument();
  });

  it('leaves the sidebar blank while the workspace loads, but not the page', () => {
    answered({ isPending: true });

    renderAt('acme-inc');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Your teams' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Inbox/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('section slot')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Workspace not found' }),
    ).not.toBeInTheDocument();
  });

  it('says the workspace could not be loaded, and tries again on request', async () => {
    const person = userEvent.setup();
    answered({ errorUpdateCount: 1 });

    renderAt('acme-inc');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The workspace could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('section slot')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Workspace not found' }),
    ).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('keeps the workspace it has when a later refresh fails', () => {
    answered({ data: acme, errorUpdateCount: 1 });

    renderAt('acme-inc');

    expect(
      screen.getByRole('button', { name: /Acme Inc\./ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('counts every host that still reports to the control plane', () => {
    loaded(acme);

    renderAt('acme-inc', '/settings/general');

    const runners = screen.getByRole('link', { name: /Runners/ });
    expect(runners).toHaveTextContent('2');
  });
});
