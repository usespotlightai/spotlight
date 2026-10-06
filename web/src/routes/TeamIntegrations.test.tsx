import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installUrlFor } from '@/lib/github';
import { TeamIntegrations } from '@/routes/TeamIntegrations';

const configuration = vi.fn();
const github = vi.fn();
const connect = vi.fn();

const failing = vi.fn();
const refetch = vi.fn();

const query = (data: unknown) => ({
  data,
  isPending: data === undefined,
  errorUpdateCount: failing() ? 1 : 0,
  isFetching: false,
  refetch,
});

vi.mock('@/hooks/api/useConfiguration', () => ({
  useConfiguration: () => query(configuration()),
}));

vi.mock('@/hooks/api/useGitHub', () => ({
  useGitHub: () => query(github()),
}));

vi.mock('@/hooks/api/useConnectIntegration', () => ({
  useConnectIntegration: () => ({ mutate: connect, isPending: false }),
}));

const ready = (over: Record<string, unknown> = {}) => ({
  connected: true,
  installUrl: 'https://github.com/apps/spotlight/installations/new',
  ...over,
});

const listening = (over: Record<string, unknown> = {}) => ({
  source: 'linear',
  name: 'Linear',
  path: 'integrations/linear',
  standing: 'listens',
  handle: null,
  ...over,
});

const read = (integrations: unknown[] = []) => ({ integrations });

const showing = () =>
  render(
    <MemoryRouter
      initialEntries={['/w/acme/settings/team/team_1/integrations']}
    >
      <Routes>
        <Route
          path="/w/:slug/settings/team/:teamId/integrations"
          element={<TeamIntegrations />}
        />
      </Routes>
    </MemoryRouter>,
  );

const INSTALL = installUrlFor(
  'https://github.com/apps/spotlight/installations/new',
  {
    slug: 'acme',
    teamId: 'team_1',
    from: '/w/acme/settings/team/team_1/integrations',
  },
);

beforeEach(() => {
  failing.mockReturnValue(false);
  refetch.mockClear();
  connect.mockClear();
});

describe('TeamIntegrations', () => {
  it('holds the shape of an integration while they load, keeping what never changes', () => {
    github.mockReturnValue(undefined);
    configuration.mockReturnValue(undefined);
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading GitHub' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Loading the integrations' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hosts' })).toBeInTheDocument();
    expect(screen.queryByText(/listens to no host/)).not.toBeInTheDocument();
  });

  it('shows GitHub once the team is known, while the hosts still load', () => {
    github.mockReturnValue(ready());
    configuration.mockReturnValue(undefined);
    showing();

    expect(screen.queryByRole('status', { name: 'Loading GitHub' })).toBeNull();
    expect(
      screen.getByRole('status', { name: 'Loading the integrations' }),
    ).toBeInTheDocument();
  });

  it('says the integrations could not be loaded, and tries again when asked', async () => {
    github.mockReturnValue(undefined);
    configuration.mockReturnValue(undefined);
    failing.mockReturnValue(true);
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Integrations could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('says so when the team listens to no host', () => {
    github.mockReturnValue(ready());
    configuration.mockReturnValue(read());
    showing();

    expect(
      screen.getByText('No integrations configured for this team.'),
    ).toBeInTheDocument();
  });

  it('shows every host the team listens to', () => {
    github.mockReturnValue(ready());
    configuration.mockReturnValue(
      read([listening(), listening({ source: 'slack', name: 'Slack' })]),
    );
    showing();

    expect(screen.getByRole('heading', { name: 'Linear' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Slack' })).toBeInTheDocument();
  });

  it('offers nothing to choose or propose', () => {
    github.mockReturnValue(ready());
    configuration.mockReturnValue(read([listening()]));
    showing();

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /pull request/i }),
    ).not.toBeInTheDocument();
  });

  it('says a host that only listens needs nothing connected', () => {
    github.mockReturnValue(ready());
    configuration.mockReturnValue(read([listening()]));
    showing();

    expect(
      screen.getByText('Listens for incoming events.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Connect to Linear' }),
    ).not.toBeInTheDocument();
  });

  it('offers to connect a host that links by authorizing', async () => {
    github.mockReturnValue(ready());
    configuration.mockReturnValue(read([listening({ standing: 'unlinked' })]));
    showing();

    expect(screen.getByText('Not connected yet.')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Connect to Linear' }),
    );

    expect(connect).toHaveBeenCalledWith('linear');
  });

  it('says what the host calls the team once it is connected', () => {
    github.mockReturnValue(ready());
    configuration.mockReturnValue(
      read([listening({ standing: 'linked', handle: 'Acme' })]),
    );
    showing();

    expect(screen.getByText('Connected as Acme.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reconnect to Linear' }),
    ).toBeInTheDocument();
  });

  it('offers to install the App while it is not installed', () => {
    github.mockReturnValue(ready({ connected: false }));
    configuration.mockReturnValue(read());
    showing();

    expect(
      screen.getByRole('link', { name: 'Install it on GitHub' }),
    ).toHaveAttribute('href', INSTALL);
  });

  it('shows GitHub connected once the App is installed', () => {
    github.mockReturnValue(ready());
    configuration.mockReturnValue(read());
    showing();

    expect(
      screen.queryByRole('link', { name: 'Install it on GitHub' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Manage on GitHub' }),
    ).toHaveAttribute('href', INSTALL);
  });
});
