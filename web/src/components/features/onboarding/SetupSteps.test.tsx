import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupSteps } from '@/components/features/onboarding/SetupSteps';
import { installUrlFor } from '@/lib/github';

const onboardingState = {
  data: undefined as unknown,
  isPending: false,
  errorUpdateCount: 0,
};

vi.mock('@/hooks/api/useOnboarding', () => ({
  useOnboarding: () => onboardingState,
}));

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({
    data: [{ fullName: 'acme/api' }, { fullName: 'acme/config' }],
  }),
}));

const pin = vi.fn();
vi.mock('@/hooks/api/usePinConfiguration', () => ({
  usePinConfiguration: () => ({ mutate: pin, isPending: false }),
}));

const setUp = vi.fn();
vi.mock('@/hooks/api/useSetUpLines', () => ({
  useSetUpLines: () => ({ mutate: setUp, isPending: false }),
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [{ id: 'claude-code', name: 'Claude Code' }],
  }),
}));

const STEPS = [
  {
    key: 'runner',
    title: 'Start a runner',
    description: 'The machine that does the work.',
    where: '/w/acme/runners',
  },
  {
    key: 'github',
    title: 'Install the GitHub App',
    description: 'So Spotlight can read and write.',
    where: '/w/acme/team/team_1/settings/integrations',
  },
  {
    key: 'repository',
    title: 'Choose a repository',
    description: 'Where this team works.',
    where: '/w/acme/team/team_1/settings/integrations',
  },
  {
    key: 'configuration',
    title: 'Merge the setup pull request',
    description: 'Nothing is read until you do.',
    where: null,
  },
  {
    key: 'integrations',
    title: 'Choose your integrations',
    description: 'What this team listens to.',
    where: '/w/acme/team/team_1/settings/integrations',
  },
];

const onboarding = (
  over: Record<string, unknown> = {},
  done: string[] = [],
) => ({
  steps: STEPS.map((step) => ({ ...step, done: done.includes(step.key) })),
  connectedToGitHub: false,
  configRepository: null,
  repositoryOwner: 'acme',
  installUrl: 'https://github.com/apps/spotlight/installations/new',
  lines: [
    {
      key: 'delivery',
      name: 'Delivery',
      harness: null,
      repositories: [],
    },
  ],
  integrations: [{ source: 'linear' }],
  ...over,
});

const BODY = '1. Start a runner. The machine that does the work.';

const showing = (resolved = false) =>
  render(
    <MemoryRouter initialEntries={['/w/acme/inbox/item_1']}>
      <Routes>
        <Route
          path="/w/:slug/inbox/:itemId"
          element={
            <SetupSteps
              teamId="team_1"
              body={BODY}
              resolved={resolved}
              about={{
                title: 'Set up your team',
                description:
                  'A few quick steps will get everything ready for your team to start working with Spotlight.',
              }}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  onboardingState.isPending = false;
  pin.mockReset();
  setUp.mockReset();
});

describe('SetupSteps', () => {
  it('holds the steps’ place while they load, under the heading it already has', () => {
    onboardingState.data = undefined;
    onboardingState.isPending = true;
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the setup steps' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Set up your team')).toBeInTheDocument();
    expect(screen.queryByText(BODY)).not.toBeInTheDocument();
  });

  it('gives each step still to do a control of its own', () => {
    onboardingState.data = onboarding();
    showing();

    expect(screen.getByRole('link', { name: 'Enrol one' })).toHaveAttribute(
      'href',
      '/w/acme/runners',
    );
    expect(
      screen.getByRole('link', { name: 'Install on GitHub' }),
    ).toHaveAttribute(
      'href',
      installUrlFor('https://github.com/apps/spotlight/installations/new', {
        slug: 'acme',
        teamId: 'team_1',
        from: '/w/acme/inbox/item_1',
      }),
    );
    expect(screen.getByRole('link', { name: 'Choose them' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/settings/integrations',
    );
  });

  it('folds a done step away, keeping the next one open', () => {
    onboardingState.data = onboarding({}, ['runner']);
    showing();

    expect(
      screen.getByRole('button', { name: /Start a runner/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('link', { name: 'Install on GitHub' }),
    ).toBeInTheDocument();
  });

  it('shows no install control where GitHub would not say', () => {
    onboardingState.data = onboarding({ installUrl: null });
    showing();

    expect(
      screen.queryByRole('link', { name: 'Install on GitHub' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Install the GitHub App')).toBeInTheDocument();
  });

  it('carries the opening rather than leaving it to stand alone', () => {
    onboardingState.data = onboarding();
    showing();

    expect(
      screen.getByRole('heading', { name: 'Set up your team' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'A few quick steps will get everything ready for your team to start working with Spotlight.',
      ),
    ).toBeInTheDocument();
  });

  it('folds the integrations step away once one is chosen', () => {
    onboardingState.data = onboarding({}, ['integrations']);
    showing();

    expect(
      screen.getByRole('button', { name: /Choose your integrations/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('link', { name: 'Choose them' }),
    ).toBeInTheDocument();
  });

  it('falls back to the words it was written with', () => {
    onboardingState.data = undefined;
    showing();

    expect(screen.getByText(BODY)).toBeInTheDocument();
  });

  it('lets a person say which repository the setup goes in', async () => {
    onboardingState.data = onboarding({ connectedToGitHub: true });
    showing();

    await userEvent.type(screen.getByLabelText('Repository'), 'config');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(pin).toHaveBeenCalledWith('acme/config');
  });

  it("takes a name that is on nobody's list", async () => {
    onboardingState.data = onboarding({ connectedToGitHub: true });
    showing();

    await userEvent.type(
      screen.getByLabelText('Repository'),
      'brand-new{Enter}',
    );

    expect(pin).toHaveBeenCalledWith('acme/brand-new');
  });

  it('says nothing until it is confirmed', async () => {
    onboardingState.data = onboarding({ connectedToGitHub: true });
    showing();

    await userEvent.type(screen.getByLabelText('Repository'), 'bra');

    expect(pin).not.toHaveBeenCalled();
  });

  it('asks for no repository before the App is installed', () => {
    onboardingState.data = onboarding();
    showing();

    expect(screen.queryByLabelText('Repository')).not.toBeInTheDocument();
  });

  it('folds a done step’s control away until it is clicked', async () => {
    onboardingState.data = onboarding(
      { connectedToGitHub: true, configRepository: 'acme/config' },
      ['repository'],
    );
    showing();

    const toggle = screen.getByRole('button', {
      name: /Choose a repository/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Repository')).toHaveValue('config');
  });

  it('suggests the repositories that match what is typed', async () => {
    onboardingState.data = onboarding({ connectedToGitHub: true });
    showing();

    await userEvent.type(screen.getByLabelText('Repository'), 'conf');

    expect(screen.getByRole('button', { name: 'config' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'api' }),
    ).not.toBeInTheDocument();
  });

  it('fills the field from a suggestion', async () => {
    onboardingState.data = onboarding({ connectedToGitHub: true });
    showing();

    await userEvent.type(screen.getByLabelText('Repository'), 'conf');
    await userEvent.click(screen.getByRole('button', { name: 'config' }));

    expect(screen.getByLabelText('Repository')).toHaveValue('config');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(pin).toHaveBeenCalledWith('acme/config');
  });

  it('offers no line setup before a repository is chosen', () => {
    onboardingState.data = onboarding({ connectedToGitHub: true });
    showing();

    expect(
      screen.queryByRole('button', { name: /Open pull request/ }),
    ).not.toBeInTheDocument();
  });

  it('opens the setup with each line’s harness and repositories', async () => {
    onboardingState.data = onboarding({
      connectedToGitHub: true,
      configRepository: 'acme/config',
      lines: [
        {
          key: 'delivery',
          name: 'Delivery',
          harness: 'claude-code',
          repositories: ['acme/api'],
        },
      ],
    });
    showing();

    expect(screen.getByText('Delivery')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: /Open pull request/ }),
    );

    expect(setUp).toHaveBeenCalledWith([
      {
        key: 'delivery',
        harness: 'claude-code',
        model: null,
        effort: null,
        repositories: ['acme/api'],
      },
    ]);
  });

  it('starts the improvement line working in the configuration repository', async () => {
    onboardingState.data = onboarding({
      connectedToGitHub: true,
      configRepository: 'acme/config',
      lines: [
        {
          key: 'delivery',
          name: 'Delivery',
          harness: null,
          repositories: [],
        },
        {
          key: 'factory',
          name: 'Factory',
          harness: null,
          repositories: [],
        },
      ],
    });
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: /Open pull request/ }),
    );

    expect(setUp).toHaveBeenCalledWith([
      {
        key: 'delivery',
        harness: null,
        model: null,
        effort: null,
        repositories: [],
      },
      {
        key: 'factory',
        harness: null,
        model: null,
        effort: null,
        repositories: ['acme/config'],
      },
    ]);
  });

  it('locks every control once the item is resolved', () => {
    onboardingState.data = onboarding(
      { connectedToGitHub: true, configRepository: 'acme/config' },
      ['runner', 'github', 'repository', 'configuration', 'integrations'],
    );
    showing(true);

    const install = screen.getByRole('link', { name: 'Install on GitHub' });
    expect(install.closest('[inert]')).not.toBeNull();
  });

  it('leaves the controls usable while the item is unresolved', () => {
    onboardingState.data = onboarding();
    showing(false);

    const install = screen.getByRole('link', { name: 'Install on GitHub' });
    expect(install.closest('[inert]')).toBeNull();
  });

  it('suggests nothing where nothing matches', async () => {
    onboardingState.data = onboarding({ connectedToGitHub: true });
    showing();

    await userEvent.type(screen.getByLabelText('Repository'), 'brand-new');

    expect(
      screen.queryByRole('button', { name: 'config' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'api' }),
    ).not.toBeInTheDocument();
  });
});
