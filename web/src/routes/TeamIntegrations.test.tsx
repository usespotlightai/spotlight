import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installUrlFor } from '@/lib/github';
import { TeamIntegrations } from '@/routes/TeamIntegrations';

const configuration = vi.fn();
const onboarding = vi.fn();
const choose = vi.fn();
const chosen = vi.fn();
const connect = vi.fn();

vi.mock('@/hooks/api/useConfiguration', () => ({
  useConfiguration: () => ({ data: configuration(), isPending: false }),
  useRereadConfiguration: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/api/useOnboarding', () => ({
  useOnboarding: () => ({ data: onboarding(), isPending: false }),
  useChooseIntegrations: () => ({
    mutate: choose,
    isPending: false,
    ...chosen(),
  }),
}));

vi.mock('@/hooks/api/useConnectIntegration', () => ({
  useConnectIntegration: () => ({ mutate: connect, isPending: false }),
}));

vi.mock('@/components/features/integrations/SecretsPrompt', () => ({
  SecretsPrompt: ({
    integrations,
    onSubmit,
  }: {
    integrations: { source: string }[];
    onSubmit: (secrets: Record<string, string>) => void;
  }) => (
    <button
      type="button"
      onClick={() => onSubmit({ LINEAR_WEBHOOK_SECRET: 'whsec_1' })}
    >
      Give secrets for {integrations.map((each) => each.source).join(', ')}
    </button>
  ),
}));

const tool = (over: Record<string, unknown> = {}) => ({
  source: 'linear',
  name: 'Linear',
  summary: 'Move a task on when its issue is done.',
  secrets: [],
  deliverTo: '/api/webhooks/w/acme/t/platform/linear',
  ...over,
});

const steps = (undone: string[] = []) =>
  ['runner', 'github', 'repository', 'configuration', 'integrations'].map(
    (key) => ({
      key,
      title: key,
      description: key,
      where: null,
      done: !undone.includes(key),
    }),
  );

const ready = (over: Record<string, unknown> = {}) => ({
  steps: steps(),
  connectedToGitHub: true,
  configRepository: 'acme/api',
  installUrl: 'https://github.com/apps/spotlight/installations/new',
  integrations: [tool()],
  ...over,
});

const listening = (over: Record<string, unknown> = {}) => ({
  source: 'linear',
  name: 'Linear',
  path: '.spotlight/integrations/linear.yml',
  connectable: false,
  connection: null,
  ...over,
});

const read = (over: Record<string, unknown> = {}) => ({
  repository: 'acme/api',
  sha: 'a1b2c3d4',
  integrations: [],
  ...over,
});

const showing = () =>
  render(
    <MemoryRouter
      initialEntries={['/w/acme/team/team_1/settings/integrations']}
    >
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/settings/integrations"
          element={<TeamIntegrations />}
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  chosen.mockReturnValue({});
});

describe('TeamIntegrations', () => {
  it('offers the tools this team might use', () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read());
    showing();

    expect(screen.getByText('Linear')).toBeInTheDocument();
    expect(
      screen.getByText('Move a task on when its issue is done.'),
    ).toBeInTheDocument();
  });

  it('writes the configuration for the ones chosen', async () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read());
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Listen to Linear' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Open pull request' }),
    );

    expect(choose).toHaveBeenCalledWith({ sources: ['linear'], dropped: [] });
  });

  it('shows one already written as listening', () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read({ integrations: [listening()] }));
    showing();

    expect(
      screen.getByRole('button', { name: 'Stop listening to Linear' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('asks for the secrets a chosen integration reads before opening the pull request', async () => {
    choose.mockClear();
    onboarding.mockReturnValue(
      ready({ integrations: [tool({ secrets: ['LINEAR_WEBHOOK_SECRET'] })] }),
    );
    configuration.mockReturnValue(read());
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Listen to Linear' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Open pull request' }),
    );

    expect(choose).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('button', { name: 'Give secrets for linear' }),
    );

    expect(choose).toHaveBeenCalledWith(
      {
        sources: ['linear'],
        dropped: [],
        secrets: { LINEAR_WEBHOOK_SECRET: 'whsec_1' },
      },
      expect.anything(),
    );
  });

  it('says why the pull request could not be opened', () => {
    chosen.mockReturnValue({
      error: { message: 'This team has nowhere to write its configuration.' },
    });
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read());
    showing();

    expect(
      screen.getByText('This team has nowhere to write its configuration.'),
    ).toBeInTheDocument();
  });

  it('links the pull request once it is opened', () => {
    chosen.mockReturnValue({
      data: { url: 'https://github.com/acme/api/pull/7' },
    });
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read());
    showing();

    expect(
      screen.getByRole('link', {
        name: 'Merge the pull request to apply the change.',
      }),
    ).toHaveAttribute('href', 'https://github.com/acme/api/pull/7');
  });

  it('opens a listening integration’s file in the repository from Configure', () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read({ integrations: [listening()] }));
    showing();

    const configure = screen.getByRole('link', {
      name: 'Configure Linear on GitHub',
    });

    expect(configure).toHaveAttribute(
      'href',
      'https://github.com/acme/api/blob/HEAD/.spotlight/integrations/linear.yml',
    );
    expect(configure).toHaveAttribute('target', '_blank');
  });

  it('offers to connect an integration that links by authorizing', async () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(
      read({ integrations: [listening({ connectable: true })] }),
    );
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Connect to Linear' }),
    );

    expect(connect).toHaveBeenCalledWith('linear');
  });

  it('offers nothing to configure for an integration not written down', () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read());
    showing();

    expect(
      screen.queryByRole('link', { name: 'Configure Linear on GitHub' }),
    ).not.toBeInTheDocument();
  });

  it('takes away the file of one let go', async () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read({ integrations: [listening()] }));
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Stop listening to Linear' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Open pull request' }),
    );

    expect(choose).toHaveBeenCalledWith({ sources: [], dropped: ['linear'] });
  });

  it('offers to install the App while it is not installed', () => {
    onboarding.mockReturnValue(ready({ connectedToGitHub: false }));
    configuration.mockReturnValue(read());
    showing();

    expect(
      screen.getByRole('link', { name: 'Install it on GitHub' }),
    ).toHaveAttribute(
      'href',
      installUrlFor('https://github.com/apps/spotlight/installations/new', {
        slug: 'acme',
        teamId: 'team_1',
        from: '/w/acme/team/team_1/settings/integrations',
      }),
    );
  });

  it('drops the offer once it is installed', () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read());
    showing();

    expect(
      screen.queryByRole('link', { name: 'Install it on GitHub' }),
    ).not.toBeInTheDocument();
  });

  it('shows GitHub connected once the App is installed', () => {
    onboarding.mockReturnValue(ready({ configRepository: 'acme/platform' }));
    configuration.mockReturnValue(read());
    showing();

    expect(screen.getByText(/acme\/platform/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Manage on GitHub' }),
    ).toHaveAttribute(
      'href',
      installUrlFor('https://github.com/apps/spotlight/installations/new', {
        slug: 'acme',
        teamId: 'team_1',
        from: '/w/acme/team/team_1/settings/integrations',
      }),
    );
  });

  it.each([
    ['no runner', { steps: steps(['runner']) }],
    ['no App', { connectedToGitHub: false }],
    ['nothing read', { steps: steps(['configuration']) }],
  ])('says nothing of what is still needed with %s', (_, missing) => {
    onboarding.mockReturnValue(ready(missing));
    configuration.mockReturnValue(read());
    showing();

    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.queryByText('Start a runner')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Merge the opening pull request'),
    ).not.toBeInTheDocument();
  });
});
