import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Package } from 'lucide-react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandsProvider } from '@/components/shell/command/CommandsProvider';
import { useSettingUp } from '@/hooks/api/useSettingUp';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { APP_TABS_KEY } from '@/lib/app-tabs';
import { creatingOf } from '@/lib/task-create';
import { Workspace } from '@/routes/Workspace';
import { quietBrowser } from '@/test/signed-in';

vi.mock('@/hooks/api/useWorkspace', () => ({ useWorkspace: vi.fn() }));
vi.mock('@/hooks/api/useSettingUp', () => ({ useSettingUp: vi.fn() }));
vi.mock('@/hooks/useLiveStream', () => ({ useLiveStream: vi.fn() }));
vi.mock('@/hooks/useInboxNotifier', () => ({ useInboxNotifier: vi.fn() }));
vi.mock('@/hooks/useDesktopBadge', () => ({ useDesktopBadge: vi.fn() }));
vi.mock('@/hooks/useDesktopCommands', () => ({ useDesktopCommands: vi.fn() }));

const fixtures = vi.hoisted(() => ({
  lines: [] as { id: string; name: string; stations: never[] }[],
  sections: [] as unknown[],
}));

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({ data: fixtures.lines, isPending: false }),
}));
vi.mock('@/hooks/api/useTasks', () => ({
  useTasks: () => ({ data: [], isPending: false }),
  useTask: () => ({ data: undefined, isPending: false }),
}));
vi.mock('@/hooks/useCommandSections', () => ({
  useCommandSections: () => fixtures.sections,
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
const hosts = vi.fn<(...args: unknown[]) => unknown>();

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

function WindowAddress() {
  const location = useLocation();
  const state: unknown = location.state;
  const { pathname } = location;

  return (
    <p>
      Window at {pathname}
      {creatingOf(state) !== null && ', creating a task'}
    </p>
  );
}

const pages = (
  <>
    <Route index element={<p>section slot</p>} />
    <Route
      path="team/:teamId/runs"
      element={
        <>
          <p>runs slot</p>
          <Link to="settings">Open the run settings</Link>
        </>
      }
    />
    <Route path="team/:teamId/runs/settings" element={<p>run settings</p>} />
    <Route path="settings/*" element={<p>settings slot</p>} />
    <Route path="inbox" element={<p>inbox slot</p>} />
  </>
);

const renderAt = (slug: string, rest = '') =>
  render(
    <MemoryRouter initialEntries={[`/w/${slug}${rest}`]}>
      <Routes>
        <Route path="/w/:slug" element={<Workspace pages={pages} />}>
          {pages}
        </Route>
      </Routes>
      <WindowAddress />
    </MemoryRouter>,
  );

const splitTabs = () =>
  localStorage.setItem(
    `${APP_TABS_KEY}.acme-inc`,
    JSON.stringify({
      tabs: [
        { id: 'a', path: '/w/acme-inc', title: 'Home' },
        { id: 'b', path: '/w/acme-inc/team/team_1/runs', title: 'Runs' },
      ],
      activeId: 'a',
      splitId: 'b',
    }),
  );

beforeEach(() => {
  fixtures.lines = [{ id: 'line_1', name: 'Default', stations: [] }];
  fixtures.sections = [];
  mockWorkspace.mockReset();
  mockSettingUp.mockReturnValue(false);
  refetch.mockClear();
  hosts.mockReturnValue([
    { id: 'h1', name: 'one', online: true },
    { id: 'h2', name: 'two', online: true },
    { id: 'h3', name: 'three', online: false },
  ]);
});

quietBrowser();

describe('Workspace', () => {
  it('shows the split tab beside the tab at the address', () => {
    loaded(acme);
    splitTabs();

    renderAt('acme-inc');

    expect(screen.getByText('section slot')).toBeInTheDocument();
    expect(screen.getByText('runs slot')).toBeInTheDocument();
  });

  it('focuses the pane that is clicked, and the address follows it', async () => {
    const user = userEvent.setup();
    loaded(acme);
    splitTabs();

    renderAt('acme-inc');
    await user.click(
      screen.getByRole('link', { name: 'Open the run settings' }),
    );

    expect(screen.getByText('run settings')).toBeInTheDocument();
    expect(screen.getByText('section slot')).toBeInTheDocument();
    expect(
      screen.getByText('Window at /w/acme-inc/team/team_1/runs/settings'),
    ).toBeInTheDocument();
  });

  it('opens a sidebar link in the focused pane', async () => {
    const user = userEvent.setup();
    loaded(acme);
    splitTabs();

    renderAt('acme-inc');
    await user.click(screen.getByText('runs slot'));
    await user.click(screen.getByRole('link', { name: /Inbox/ }));

    expect(screen.getByText('section slot')).toBeInTheDocument();
    expect(screen.queryByText('runs slot')).not.toBeInTheDocument();
    expect(screen.getByText('inbox slot')).toBeInTheDocument();
  });

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

    expect(screen.queryByRole('status', { name: /./ })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('status', { name: /./ })).not.toBeInTheDocument();
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
  describe('on a narrow screen', () => {
    beforeEach(() => {
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query) =>
          ({
            matches: query === '(width < 48rem)',
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList,
      );
    });

    afterEach(() => {
      vi.mocked(window.matchMedia).mockRestore();
    });

    const columnOf = (text: string) =>
      screen.getByText(text).closest('section')?.parentElement?.parentElement;

    it('shows only the focused tab of a split', async () => {
      const user = userEvent.setup();
      loaded(acme);
      splitTabs();

      renderAt('acme-inc');

      expect(columnOf('section slot')).not.toHaveClass('max-md:hidden');
      expect(columnOf('runs slot')).toHaveClass('max-md:hidden');

      await user.click(screen.getByRole('button', { name: 'Runs' }));

      expect(columnOf('runs slot')).not.toHaveClass('max-md:hidden');
      expect(columnOf('section slot')).toHaveClass('max-md:hidden');
    });

    it('keeps the hidden tab of a split mounted', async () => {
      const user = userEvent.setup();
      loaded(acme);
      splitTabs();

      renderAt('acme-inc');
      const runs = await screen.findByText('runs slot');

      await user.click(screen.getByRole('button', { name: 'Runs' }));
      await user.click(screen.getByRole('button', { name: 'Home' }));

      expect(screen.getByText('runs slot')).toBe(runs);
    });
  });

  describe('keyboard', () => {
    const renderWithKeys = (rest = '') =>
      render(
        <CommandsProvider>
          <MemoryRouter initialEntries={[`/w/acme-inc${rest}`]}>
            <Routes>
              <Route path="/w/:slug" element={<Workspace pages={pages} />}>
                {pages}
              </Route>
            </Routes>
            <WindowAddress />
          </MemoryRouter>
        </CommandsProvider>,
      );

    const press = (...keys: string[]) => {
      for (const key of keys) {
        fireEvent.keyDown(document.activeElement ?? document.body, { key });
      }
    };

    it('goes to the Inbox with G then I', () => {
      loaded(acme);
      renderWithKeys();

      press('g', 'i');

      expect(
        screen.getByText('Window at /w/acme-inc/inbox'),
      ).toBeInTheDocument();
    });

    it('goes to a section of the team in the address with G and its key', () => {
      loaded({
        ...acme,
        teams: [
          { id: 'team_0', name: 'Growth' },
          { id: 'team_1', name: 'Platform' },
        ],
      });
      renderWithKeys('/team/team_1/runs');

      press('g', 'm');

      expect(
        screen.getByText('Window at /w/acme-inc/team/team_1/memory'),
      ).toBeInTheDocument();
    });

    it('goes to the only line of the team with G then L', () => {
      loaded(acme);
      renderWithKeys();

      press('g', 'l');

      expect(
        screen.getByText('Window at /w/acme-inc/team/team_1/lines/line_1'),
      ).toBeInTheDocument();
    });

    it('goes to the line to create a task with C', () => {
      loaded(acme);
      renderWithKeys();

      press('c');

      expect(
        screen.getByText(
          'Window at /w/acme-inc/team/team_1/lines/line_1, creating a task',
        ),
      ).toBeInTheDocument();
    });

    it('asks for the line with C when the team has several lines', async () => {
      const user = userEvent.setup();
      loaded(acme);
      fixtures.lines = [
        { id: 'line_1', name: 'Default', stations: [] },
        { id: 'line_2', name: 'Incidents', stations: [] },
      ];
      fixtures.sections = [
        {
          heading: 'Lines',
          targets: [
            {
              id: 'line:line_2',
              label: 'Incidents',
              icon: Package,
              to: '/w/acme-inc/team/team_1/lines/line_2',
            },
          ],
        },
      ];
      renderWithKeys();

      press('c');
      await user.click(
        await screen.findByRole('option', { name: /Incidents/ }),
      );

      expect(
        screen.getByText(
          'Window at /w/acme-inc/team/team_1/lines/line_2, creating a task',
        ),
      ).toBeInTheDocument();
    });

    it('shows the keyboard shortcuts with ?', async () => {
      loaded(acme);
      renderWithKeys();

      press('?');

      expect(
        await screen.findByRole('dialog', { name: 'Keyboard shortcuts' }),
      ).toBeInTheDocument();
    });

    it('opens the palette with Command K and lists the commands with their keys', async () => {
      loaded(acme);
      renderWithKeys();

      fireEvent.keyDown(document.body, { key: 'k', metaKey: true });

      const palette = await screen.findByRole('dialog', { name: 'Search' });
      const actions = within(palette).getByRole('group', { name: 'Actions' });
      expect(
        within(actions).getByRole('option', {
          name: /Show keyboard shortcuts/,
        }),
      ).toHaveTextContent('?');
    });

    it('runs a command picked in the palette', async () => {
      const user = userEvent.setup();
      loaded(acme);
      renderWithKeys();

      fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
      await user.click(
        await screen.findByRole('option', { name: /Show keyboard shortcuts/ }),
      );

      expect(
        await screen.findByRole('dialog', { name: 'Keyboard shortcuts' }),
      ).toBeInTheDocument();
    });

    it('opens the palette on the lines with O then L', async () => {
      loaded(acme);
      renderWithKeys();

      press('o', 'l');

      expect(
        await screen.findByPlaceholderText('Open a line…'),
      ).toBeInTheDocument();
    });
  });
});
