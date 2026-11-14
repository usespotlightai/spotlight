import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { AppTabStrip } from '@/components/shell/tabs/AppTabStrip';
import { TabDrag } from '@/components/shell/tabs/TabDrag';
import { useAppTabs } from '@/hooks/useAppTabs';
import { APP_TABS_KEY } from '@/lib/app-tabs';
import { TabTitleContext } from '@/lib/tab-title';

const TEAMS = [
  { id: 'team_1', name: 'Platform' },
  { id: 'team_2', name: 'Growth' },
];

type PageProps = { title: string; to?: string };

function Page({ title, to }: PageProps) {
  return (
    <>
      <Breadcrumbs segments={[{ label: title }]} />
      {to && <Link to={to}>Open</Link>}
    </>
  );
}

function Address() {
  const { pathname } = useLocation();

  return <output aria-label="Address">{pathname}</output>;
}

function Shell() {
  const tabs = useAppTabs('acme', TEAMS);

  return (
    <>
      <TabDrag
        tabs={tabs.tabs}
        activeId={tabs.activeId}
        canPlace={tabs.canPlace}
        onMove={tabs.move}
        onPlace={tabs.place}
      >
        <AppTabStrip
          tabs={tabs.tabs}
          activeId={tabs.activeId}
          splitId={tabs.splitId}
          onSelect={tabs.select}
          onClose={tabs.close}
          canGoBack={tabs.canGoBack}
          canGoForward={tabs.canGoForward}
          onOpen={tabs.open}
          onBack={tabs.back}
          onForward={tabs.forward}
        />
      </TabDrag>
      <button
        type="button"
        onClick={() => {
          const [first, ...rest] = tabs.tabs;
          const last = rest.at(-1);

          if (first && last) {
            tabs.move(first.id, last.id);
          }
        }}
      >
        Move the first tab to the end
      </button>
      <TabTitleContext value={tabs.titleFor(tabs.activeId)}>
        <Routes>
          <Route path="/w/:slug/inbox" element={<Page title="Inbox" />} />
          <Route
            path="/w/:slug/team/:teamId/agent"
            element={<Page title="Agent" />}
          />
          <Route
            path="/w/:slug/team/:teamId/runs"
            element={<Page title="Runs" to="/w/acme/team/team_2/runs/run_1" />}
          />
          <Route
            path="/w/:slug/team/:teamId/runs/:runId"
            element={<Page title="Fix the login" />}
          />
        </Routes>
      </TabTitleContext>
      <Address />
    </>
  );
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Shell />
    </MemoryRouter>,
  );

const strip = () => within(screen.getByRole('navigation', { name: 'Tabs' }));

const tab = (name: string) => strip().getByRole('button', { name });

const address = () => screen.getByRole('status', { name: 'Address' });

beforeEach(() => {
  localStorage.clear();
  Object.assign(window, { spotlightDesktop: { platform: 'darwin' } });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'spotlightDesktop');
});

describe('useAppTabs', () => {
  it('names the tab after the page it shows', async () => {
    renderAt('/w/acme/team/team_2/runs');

    expect(
      await strip().findByRole('button', { name: 'Runs' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('renames the tab when the page in it changes', async () => {
    const user = userEvent.setup();
    renderAt('/w/acme/team/team_2/runs');

    await user.click(screen.getByRole('link', { name: 'Open' }));

    expect(tab('Fix the login')).toHaveAttribute('aria-current', 'page');
    expect(strip().queryByRole('button', { name: 'Runs' })).toBeNull();
  });

  it('goes back and forward within the tab and keeps the history stored', async () => {
    const user = userEvent.setup();
    renderAt('/w/acme/team/team_2/runs');

    const backButton = strip().getByRole('button', { name: 'Back' });
    const forwardButton = strip().getByRole('button', { name: 'Forward' });

    expect(backButton).toBeDisabled();
    expect(forwardButton).toBeDisabled();

    await user.click(screen.getByRole('link', { name: 'Open' }));
    await user.click(backButton);

    expect(address()).toHaveTextContent('/w/acme/team/team_2/runs');
    expect(backButton).toBeDisabled();
    expect(forwardButton).toBeEnabled();

    const stored = JSON.parse(
      localStorage.getItem(`${APP_TABS_KEY}.acme`) ?? '{}',
    ) as { tabs: { forward: unknown }[] };

    expect(stored.tabs[0].forward).toEqual([
      { path: '/w/acme/team/team_2/runs/run_1' },
    ]);

    await user.click(forwardButton);

    expect(address()).toHaveTextContent('/w/acme/team/team_2/runs/run_1');
    expect(forwardButton).toBeDisabled();
    expect(backButton).toBeEnabled();
  });

  it('opens a new tab at the agent of the team on the page', async () => {
    const user = userEvent.setup();
    renderAt('/w/acme/team/team_2/runs');

    await user.click(tab('New tab'));

    expect(address()).toHaveTextContent('/w/acme/team/team_2/agent');
    expect(tab('Agent')).toHaveAttribute('aria-current', 'page');
    expect(tab('Runs')).not.toHaveAttribute('aria-current');
  });

  it('opens a new tab at the agent of the first team outside a team', async () => {
    const user = userEvent.setup();
    renderAt('/w/acme/inbox');

    await user.click(tab('New tab'));

    expect(address()).toHaveTextContent('/w/acme/team/team_1/agent');
  });

  it('keeps the place of each tab when you switch tabs', async () => {
    const user = userEvent.setup();
    renderAt('/w/acme/team/team_2/runs');

    await user.click(screen.getByRole('link', { name: 'Open' }));
    await user.click(tab('New tab'));
    await user.click(tab('Fix the login'));

    expect(address()).toHaveTextContent('/w/acme/team/team_2/runs/run_1');
    expect(tab('Fix the login')).toHaveAttribute('aria-current', 'page');

    await user.click(tab('Agent'));

    expect(address()).toHaveTextContent('/w/acme/team/team_2/agent');
  });

  it('shows the next tab when you close the active tab', async () => {
    const user = userEvent.setup();
    renderAt('/w/acme/inbox');

    await user.click(tab('New tab'));
    await user.click(tab('Inbox'));
    await user.click(tab('Close Inbox'));

    expect(address()).toHaveTextContent('/w/acme/team/team_1/agent');
    expect(strip().getAllByRole('listitem')).toHaveLength(1);
  });

  it('has no close button on the only tab', async () => {
    renderAt('/w/acme/inbox');

    await strip().findByRole('button', { name: 'Inbox' });

    expect(strip().queryByRole('button', { name: 'Close Inbox' })).toBeNull();
  });

  it('moves a tab, and gives back the new order next time round', async () => {
    const user = userEvent.setup();
    const first = renderAt('/w/acme/inbox');

    await user.click(tab('New tab'));
    await user.click(
      screen.getByRole('button', { name: 'Move the first tab to the end' }),
    );

    const titles = () =>
      strip()
        .getAllByRole('listitem')
        .map((each) => each.textContent);

    expect(titles()).toEqual(['Agent', 'Inbox']);
    expect(tab('Agent')).toHaveAttribute('aria-current', 'page');

    first.unmount();
    renderAt('/w/acme/team/team_1/agent');

    expect(titles()).toEqual(['Agent', 'Inbox']);
  });

  it('gives back the tabs next time round', async () => {
    const user = userEvent.setup();
    const first = renderAt('/w/acme/inbox');

    await user.click(tab('New tab'));
    first.unmount();

    renderAt('/w/acme/team/team_1/agent');

    expect(
      strip()
        .getAllByRole('listitem')
        .map((each) => each.textContent),
    ).toEqual(['Inbox', 'Agent']);
    expect(tab('Agent')).toHaveAttribute('aria-current', 'page');
  });
});
