import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { AppTabStrip } from '@/components/shell/tabs/AppTabStrip';
import { useAppTabs } from '@/hooks/useAppTabs';
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
      <AppTabStrip
        tabs={tabs.tabs}
        activeId={tabs.activeId}
        onSelect={tabs.select}
        onClose={tabs.close}
        onOpen={tabs.open}
      />
      <TabTitleContext value={tabs.report}>
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
