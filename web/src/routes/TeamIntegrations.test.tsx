import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { installUrlFor } from '@/lib/github';
import { TeamIntegrations } from '@/routes/TeamIntegrations';

const configuration = vi.fn();
const onboarding = vi.fn();
const choose = vi.fn();

vi.mock('@/hooks/api/useConfiguration', () => ({
  configurationKeys: { forTeam: () => ['configuration'] },
  useConfiguration: () => ({ data: configuration(), isPending: false }),
  useRereadConfiguration: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/api/useOnboarding', () => ({
  onboardingKeys: { forTeam: () => ['onboarding'] },
  useOnboarding: () => ({ data: onboarding(), isPending: false }),
  useChooseTools: () => ({ mutate: choose, isPending: false }),
}));

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [{ fullName: 'acme/api' }] }),
}));

vi.mock('@/hooks/api/usePinConfiguration', () => ({
  usePinConfiguration: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/api/useSetSecret', () => ({
  useSetSecret: () => ({ mutate: vi.fn(), isPending: false }),
}));

const tool = (over: Record<string, unknown> = {}) => ({
  source: 'linear',
  name: 'Linear',
  summary: 'Move a task on when its issue is done.',
  secretCalled: 'the signing secret',
  chosen: false,
  ...over,
});

/** The list as the control plane hands it over, with everything done. */
const steps = (undone: string[] = []) =>
  ['runner', 'github', 'repository', 'configuration', 'tools'].map((key) => ({
    key,
    title: key,
    description: key,
    where: null,
    done: !undone.includes(key),
  }));

const ready = (over: Record<string, unknown> = {}) => ({
  steps: steps(),
  connectedToGitHub: true,
  configRepository: 'acme/api',
  installUrl: 'https://github.com/apps/spotlight/installations/new',
  tools: [tool()],
  ...over,
});

const listening = (over: Record<string, unknown> = {}) => ({
  source: 'linear',
  name: 'Linear',
  deliverTo: 'https://spotlight.test/deliveries/x',
  secrets: [{ name: 'LINEAR_WEBHOOK_SECRET', set: true }],
  happenings: [],
  connectable: false,
  connection: null,
  ...over,
});

const read = (over: Record<string, unknown> = {}) => ({
  repository: 'acme/api',
  sha: 'a1b2c3d4',
  readAt: '2026-09-03T06:00:00.000Z',
  integrations: [],
  problems: [],
  ...over,
});

const showing = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1/integrations']}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/integrations"
          element={<TeamIntegrations />}
        />
      </Routes>
    </MemoryRouter>,
  );

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

  // Written and not written on the same page, so a team sees what it runs.
  it('shows one already written as listening', () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read({ integrations: [listening()] }));
    showing();

    expect(
      screen.getByRole('button', { name: 'Stop listening to Linear' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  // What a host still needs from a person is a dialog away, so every card is
  // the same size whether or not its host is listening.
  it('keeps what a host still needs behind Configure', async () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read({ integrations: [listening()] }));
    showing();

    expect(
      screen.queryByText('https://spotlight.test/deliveries/x'),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Configure' }));

    expect(
      screen.getByText('https://spotlight.test/deliveries/x'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('LINEAR_WEBHOOK_SECRET')).toBeInTheDocument();
  });

  it('offers nothing to configure for a host not written down', () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read());
    showing();

    expect(
      screen.queryByRole('button', { name: 'Configure' }),
    ).not.toBeInTheDocument();
  });

  // Letting one go is the same gesture as taking one up, and the same PR.
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

  // The one host reached through something of Spotlight's own, so it is the
  // one connected with a button rather than a file.
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
        from: '/w/acme/team/team_1/integrations',
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

  // Installed, it is still an integration, so the page shows it stands connected
  // and where to go to manage it.
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
        from: '/w/acme/team/team_1/integrations',
      }),
    );
  });

  // Opening a team is where that is asked about. This page never says it.
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

  // This page is for what a team listens to. What will not read is said where
  // the reading is done, not here.
  it('says nothing of what is wrong with the files', () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue({
      ...read(),
      problems: [
        {
          path: 'a.yml',
          at: 'happenings.0.when',
          reason: 'must be an expression',
        },
      ],
    });
    showing();

    expect(screen.queryByText('1 problem to fix')).not.toBeInTheDocument();
    expect(screen.queryByText('must be an expression')).not.toBeInTheDocument();
  });
});
