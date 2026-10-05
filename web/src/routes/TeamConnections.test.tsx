import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamConnections } from '@/routes/TeamConnections';

const configuration = vi.fn();
const connections = vi.fn();
const connect = vi.fn();
const disconnect = vi.fn();
const setRule = vi.fn();
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

vi.mock('@/hooks/api/useConnections', () => ({
  useConnections: () => query(connections()),
}));

vi.mock('@/hooks/api/useConnectIntegration', () => ({
  useConnectIntegration: () => ({ mutate: connect, isPending: false }),
}));

vi.mock('@/hooks/api/useDisconnect', () => ({
  useDisconnect: () => ({ mutate: disconnect, isPending: false }),
}));

vi.mock('@/hooks/api/useSetToolRule', () => ({
  useSetToolRule: () => ({ mutate: setRule, isPending: false }),
}));

const integration = (over: Record<string, unknown> = {}) => ({
  source: 'linear',
  name: 'Linear',
  path: 'integrations/linear',
  standing: 'linked',
  holding: 'requester',
  handle: 'Acme',
  ...over,
});

const AT = '2026-10-01T09:00:00.000Z';

const showing = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/settings/team/team_1/connections']}>
      <Routes>
        <Route
          path="/w/:slug/settings/team/:teamId/connections"
          element={<TeamConnections />}
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  failing.mockReturnValue(false);
  configuration.mockReturnValue(undefined);
  connections.mockReturnValue(undefined);
  connect.mockClear();
  disconnect.mockClear();
  setRule.mockClear();
  refetch.mockClear();
});

describe('TeamConnections', () => {
  it('shows a faithful skeleton while it loads', () => {
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the connections' }),
    ).toBeInTheDocument();
  });

  it('says it could not load, and tries again', async () => {
    failing.mockReturnValue(true);
    showing();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(refetch).toHaveBeenCalled();
  });

  it('points to the integrations when none acts as each person', () => {
    configuration.mockReturnValue({
      integrations: [integration({ holding: 'team' })],
    });
    connections.mockReturnValue({ mine: [], people: null });
    showing();

    expect(
      screen.getByText('No integration here acts as each person'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'See the integrations' }),
    ).toHaveAttribute('href', '/w/acme/settings/team/team_1/integrations');
  });

  it('lets a person connect their own account, landing back here', async () => {
    configuration.mockReturnValue({ integrations: [integration()] });
    connections.mockReturnValue({ mine: [], people: null });
    showing();

    expect(screen.getByText('Not connected')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Connect Linear' }),
    );

    expect(connect).toHaveBeenCalledWith({
      source: 'linear',
      for: 'me',
      back: '/w/acme/settings/team/team_1/connections',
    });
  });

  it('shows whom a person is connected as, and lets them disconnect', async () => {
    configuration.mockReturnValue({ integrations: [integration()] });
    connections.mockReturnValue({
      mine: [{ source: 'linear', handle: '@sam', connectedAt: AT, tools: [] }],
      people: null,
    });
    showing();

    expect(screen.getByText('Connected as @sam')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Disconnect Linear' }),
    );

    expect(disconnect).toHaveBeenCalledWith('linear');
    expect(screen.queryByText('Who has connected')).not.toBeInTheDocument();
  });

  it('lets a person ask first or block a tool on calls made with their connection', async () => {
    configuration.mockReturnValue({ integrations: [integration()] });
    connections.mockReturnValue({
      mine: [
        {
          source: 'linear',
          handle: '@sam',
          connectedAt: AT,
          tools: [
            { tool: 'linear.comment', rule: 'needs-approval' },
            { tool: 'linear.issue-create', rule: 'allowed' },
          ],
        },
      ],
      people: null,
    });
    showing();

    expect(
      screen.getByRole('button', { name: 'Rule for linear.comment' }),
    ).toHaveTextContent('Ask me first');
    await userEvent.click(
      screen.getByRole('button', { name: 'Rule for linear.issue-create' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: /Blocked/ }),
    );

    expect(setRule).toHaveBeenCalledWith({
      source: 'linear',
      tool: 'linear.issue-create',
      rule: 'blocked',
    });
  });

  it('shows an admin who in the team has connected what', () => {
    configuration.mockReturnValue({ integrations: [integration()] });
    connections.mockReturnValue({
      mine: [],
      people: [
        {
          source: 'linear',
          personId: 'user_2',
          name: 'Maya Chen',
          handle: '@maya',
          connectedAt: AT,
        },
      ],
    });
    showing();

    expect(screen.getByText('Who has connected')).toBeInTheDocument();
    expect(screen.getByText('Maya Chen')).toBeInTheDocument();
    expect(screen.getByText('Linear as @maya')).toBeInTheDocument();
  });
});
