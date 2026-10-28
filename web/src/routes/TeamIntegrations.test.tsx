import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installUrlFor } from '@/lib/github';
import { TeamIntegrations } from '@/routes/TeamIntegrations';

const configuration = vi.fn();
const github = vi.fn();
const connections = vi.fn();
const members = vi.fn();
const role = vi.fn();
const connect = vi.fn();
const disconnect = vi.fn();
const connectFailed = vi.fn();
const disconnectFailed = vi.fn();

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

vi.mock('@/hooks/api/useIntegrationConnections', () => ({
  useIntegrationConnections: () => query(connections()),
}));

vi.mock('@/hooks/api/useMembers', () => ({
  useMembers: () => query(members()),
}));

const repositories = vi.fn();
const lines = vi.fn();

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => query(repositories()),
}));

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => query(lines()),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({ data: { id: 'ws_1', role: role() } }),
}));

vi.mock('@/hooks/api/useConnectIntegration', () => ({
  useConnectIntegration: () => ({
    mutate: connect,
    isPending: false,
    isError: connectFailed(),
  }),
}));

vi.mock('@/hooks/api/useDisconnectIntegration', () => ({
  useDisconnectIntegration: () => ({
    mutate: disconnect,
    isPending: false,
    isError: disconnectFailed(),
  }),
}));

vi.mock('@/hooks/api/useSetToolRule', () => ({
  useSetToolRule: () => ({ mutate: vi.fn(), isPending: false }),
}));

const ready = (over: Record<string, unknown> = {}) => ({
  connected: true,
  installUrl: 'https://github.com/apps/spotlight/installations/new',
  ...over,
});

const integration = (over: Record<string, unknown> = {}) => ({
  integration: 'pagerduty',
  name: 'PagerDuty',
  path: 'integrations/pagerduty.tf',
  connectionStatus: 'not-required',
  actsAs: 'team',
  linkedAccount: null,
  spec: null,
  ...over,
});

const personal = (over: Record<string, unknown> = {}) =>
  integration({
    integration: 'linear',
    name: 'Linear',
    path: 'integrations/linear.tf',
    connectionStatus: 'connected',
    actsAs: 'requester',
    linkedAccount: '@acme-bot',
    ...over,
  });

const read = (integrations: unknown[] = []) => ({ integrations });

const joined = (over: Record<string, unknown> = {}) => ({
  mine: [],
  people: null,
  ...over,
});

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

const row = (name: string) =>
  screen.getByRole('button', { name }).closest('li') as HTMLElement;

const head = (name: string) =>
  within(
    row(name).querySelector('[data-slot="integration-head"]') as HTMLElement,
  );

const fact = (opened: HTMLElement, label: string) =>
  within(opened).getByText(label, { selector: 'dt' })
    .nextElementSibling as HTMLElement;

const opening = async (name: string) => {
  await userEvent.click(screen.getByRole('button', { name }));
  return row(name);
};

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
  disconnect.mockClear();
  connectFailed.mockReturnValue(false);
  disconnectFailed.mockReturnValue(false);
  github.mockReturnValue(ready());
  configuration.mockReturnValue(read());
  connections.mockReturnValue(joined());
  members.mockReturnValue(undefined);
  role.mockReturnValue('owner');
  repositories.mockReturnValue([
    { fullName: 'acme/api' },
    { fullName: 'acme/web' },
  ]);
  lines.mockReturnValue([
    {
      id: 'line_1',
      repositories: [
        {
          fullName: 'acme/api',
          host: 'github',
          url: 'https://github.com/acme/api',
        },
      ],
    },
  ]);
});

describe('TeamIntegrations', () => {
  it('keeps the shape of the list while it loads', () => {
    configuration.mockReturnValue(undefined);
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the integrations' }),
    ).toBeInTheDocument();
  });

  it('says the integrations could not be loaded, and tries again on request', async () => {
    configuration.mockReturnValue(undefined);
    failing.mockReturnValue(true);
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Integrations could not be loaded.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('lists GitHub first, then every integration, in one list', () => {
    configuration.mockReturnValue(read([integration(), personal()]));
    showing();

    const names = [
      ...screen.getByRole('list', { name: 'Integrations' }).children,
    ].map((each) => each.textContent);

    expect(names[0]).toContain('GitHub');
    expect(names[1]).toContain('PagerDuty');
    expect(names[2]).toContain('Linear');
  });

  it('offers to install the App while it is not installed', () => {
    github.mockReturnValue(ready({ connected: false }));
    showing();

    expect(
      head('GitHub').getByRole('link', { name: 'Install on GitHub' }),
    ).toHaveAttribute('href', INSTALL);
    expect(
      screen.getByText('Not installed on this team’s repositories'),
    ).toBeInTheDocument();
  });

  it('says which repositories the App can access, and keeps managing it in the opened row', async () => {
    showing();

    expect(screen.getByText('Can access 2 repositories')).toBeInTheDocument();
    expect(
      head('GitHub').queryByRole('link', { name: 'Manage on GitHub' }),
    ).not.toBeInTheDocument();

    const opened = await opening('GitHub');

    expect(fact(opened, 'Can access')).toHaveTextContent('acme/api, acme/web');
    expect(fact(opened, 'Lines use')).toHaveTextContent('acme/api');
    expect(
      within(opened).getByRole('link', { name: 'Manage on GitHub' }),
    ).toHaveAttribute('href', INSTALL);
  });

  it('marks a repository the team’s lines use that the App cannot access', async () => {
    lines.mockReturnValue([
      {
        id: 'line_1',
        repositories: [
          {
            fullName: 'acme/api',
            host: 'github',
            url: 'https://github.com/acme/api',
          },
          {
            fullName: 'acme/infra',
            host: 'github',
            url: 'https://github.com/acme/infra',
          },
        ],
      },
    ]);
    showing();

    expect(
      head('GitHub').getByRole('img', { name: 'Repositories not accessible' }),
    ).toHaveAccessibleDescription('The App can’t access acme/infra.');

    const used = fact(await opening('GitHub'), 'Lines use');

    expect(
      within(used).getByRole('img', { name: 'Not accessible' }),
    ).toBeInTheDocument();
  });

  it('says an integration that only receives events needs no account', async () => {
    configuration.mockReturnValue(read([integration()]));
    showing();

    expect(screen.getByText('Receives events')).toBeInTheDocument();

    const opened = await opening('PagerDuty');

    expect(
      within(opened).queryByText('Team account', { selector: 'dt' }),
    ).not.toBeInTheDocument();
    expect(fact(opened, 'Defined in')).toHaveTextContent(
      'integrations/pagerduty.tf',
    );
  });

  it('asks an admin to connect the team account, without opening the row', async () => {
    configuration.mockReturnValue(
      read([
        integration({
          connectionStatus: 'disconnected',
          name: 'Grafana',
          integration: 'grafana',
        }),
      ]),
    );
    showing();

    await userEvent.click(
      head('Grafana').getByRole('button', {
        name: 'Connect team account for Grafana',
      }),
    );

    expect(connect).toHaveBeenCalledWith({ integration: 'grafana' });
    expect(screen.getByRole('button', { name: 'Grafana' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('tells a member that an admin has to connect the team account', () => {
    role.mockReturnValue('member');
    configuration.mockReturnValue(
      read([
        integration({
          connectionStatus: 'disconnected',
          name: 'Grafana',
          integration: 'grafana',
        }),
      ]),
    );
    showing();

    expect(screen.getByText('Waiting for an admin')).toBeInTheDocument();
    expect(
      head('Grafana').queryByRole('button', { name: /Connect team account/ }),
    ).not.toBeInTheDocument();
  });

  it('says which account the team is connected as, and what it is for', async () => {
    configuration.mockReturnValue(
      read([
        integration({
          connectionStatus: 'connected',
          linkedAccount: 'acme-production',
          name: 'Honeycomb',
          integration: 'honeycomb',
          spec: {
            kind: 'mcp',
            tools: 24,
            readAt: new Date().toISOString(),
            problem: null,
          },
        }),
      ]),
    );
    showing();

    expect(screen.getByText('Acts as the team · 24 tools')).toBeInTheDocument();

    const team = fact(await opening('Honeycomb'), 'Team account');

    expect(team).toHaveTextContent('acme-production');
    expect(team).toHaveTextContent('Agents’ tools act as this account.');
  });

  it('opens and closes a row from anywhere on it', async () => {
    configuration.mockReturnValue(read([integration()]));
    showing();

    await userEvent.click(screen.getByText('Receives events'));

    expect(screen.getByRole('button', { name: 'PagerDuty' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await userEvent.click(screen.getByText('Receives events'));

    expect(screen.getByRole('button', { name: 'PagerDuty' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('marks an unreadable API spec with an icon that says why', () => {
    configuration.mockReturnValue(
      read([
        integration({
          spec: {
            kind: 'graphql',
            tools: 0,
            readAt: new Date().toISOString(),
            problem: 'could not be read: api.linear.app answered 401',
          },
        }),
      ]),
    );
    showing();

    expect(
      screen.getByRole('img', { name: 'Could not be read' }),
    ).toHaveAccessibleDescription(
      'Its GraphQL schema could not be read: api.linear.app answered 401.',
    );
  });

  it('asks a person to connect their own account where tools act as each person', async () => {
    configuration.mockReturnValue(read([personal()]));
    showing();

    expect(screen.getByText('Acts as each person')).toBeInTheDocument();

    await userEvent.click(
      head('Linear').getByRole('button', {
        name: 'Connect your account for Linear',
      }),
    );

    expect(connect).toHaveBeenCalledWith({
      integration: 'linear',
      actsAs: 'requester',
      returnTo: '/w/acme/settings/team/team_1/integrations',
    });
  });

  it('shows both accounts side by side, with the person’s rule for each tool', async () => {
    configuration.mockReturnValue(read([personal()]));
    connections.mockReturnValue(
      joined({
        mine: [
          {
            integration: 'linear',
            linkedAccount: '@sam',
            connectedAt: new Date().toISOString(),
            tools: [{ tool: 'linear.issue-create', rule: 'needs-approval' }],
          },
        ],
      }),
    );
    showing();

    const opened = await opening('Linear');

    expect(fact(opened, 'Team account')).toHaveTextContent(
      'Watches and posts for the team.',
    );

    const yours = fact(opened, 'Your account');

    expect(yours).toHaveTextContent('@sam');
    expect(fact(opened, 'Your tool rules')).toHaveTextContent('issue-create');

    expect(
      within(yours).queryByRole('button', { name: /^Disconnect/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(yours).getByRole('button', {
        name: 'Actions for your Linear account',
      }),
    );
    expect(
      screen.queryByRole('menuitem', { name: 'Reconnect' }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Disconnect' }),
    );

    expect(disconnect).toHaveBeenCalledWith('linear');
  });

  it('lets an admin change the team account from a menu once it is connected', async () => {
    configuration.mockReturnValue(read([personal()]));
    showing();

    const team = fact(await opening('Linear'), 'Team account');

    await userEvent.click(
      within(team).getByRole('button', {
        name: 'Actions for the team’s Linear account',
      }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Change account' }),
    );

    expect(connect).toHaveBeenCalledWith({ integration: 'linear' });
  });

  it('shows an admin who has connected their own account, and who has not', async () => {
    configuration.mockReturnValue(read([personal()]));
    connections.mockReturnValue(
      joined({
        people: [
          {
            integration: 'linear',
            linkedAccount: '@sam',
            connectedAt: new Date().toISOString(),
            personId: 'user_1',
            name: 'Sam Rivera',
          },
        ],
      }),
    );
    members.mockReturnValue([
      {
        id: 'user_1',
        name: 'Sam Rivera',
        image: null,
        role: 'owner',
        assignableRoles: [],
      },
      {
        id: 'user_2',
        name: 'Maya Chen',
        image: null,
        role: 'member',
        assignableRoles: [],
      },
    ]);
    showing();

    const people = fact(await opening('Linear'), 'People');

    expect(people).toHaveTextContent('Sam Rivera');
    expect(people).toHaveTextContent('Not connected: Maya Chen');
  });

  it('says when the team account could not be connected', () => {
    connectFailed.mockReturnValue(true);
    configuration.mockReturnValue(
      read([
        integration({
          connectionStatus: 'disconnected',
          name: 'Grafana',
          integration: 'grafana',
        }),
      ]),
    );
    showing();

    expect(head('Grafana').getByRole('alert')).toHaveTextContent(
      'Could not connect. Try again.',
    );
  });

  it('says when a person’s own account could not be connected', () => {
    connectFailed.mockReturnValue(true);
    configuration.mockReturnValue(read([personal()]));
    showing();

    expect(head('Linear').getByRole('alert')).toHaveTextContent(
      'Could not connect. Try again.',
    );
  });

  it('says when a person’s own account could not be disconnected', async () => {
    disconnectFailed.mockReturnValue(true);
    configuration.mockReturnValue(read([personal()]));
    connections.mockReturnValue(
      joined({
        mine: [
          {
            integration: 'linear',
            linkedAccount: '@sam',
            connectedAt: new Date().toISOString(),
            tools: [],
          },
        ],
      }),
    );
    showing();

    const yours = fact(await opening('Linear'), 'Your account');

    expect(within(yours).getByRole('alert')).toHaveTextContent(
      'Could not disconnect. Try again.',
    );
  });

  it('says when the team account could not be changed', async () => {
    connectFailed.mockReturnValue(true);
    configuration.mockReturnValue(read([personal()]));
    showing();

    const team = fact(await opening('Linear'), 'Team account');

    expect(within(team).getByRole('alert')).toHaveTextContent(
      'Could not connect. Try again.',
    );
  });
});
