import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupSteps } from '@/components/features/onboarding/SetupSteps';
import { installUrlFor } from '@/lib/github';

const refetch = vi.fn();
const onboardingState = {
  data: undefined as unknown,
  isPending: false,
  isFetching: false,
  errorUpdateCount: 0,
  refetch,
};

vi.mock('@/hooks/api/useOnboarding', () => ({
  useOnboarding: () => onboardingState,
}));

const INSTALL = 'https://github.com/apps/spotlight/installations/new';
const githubState = {
  data: { connected: false, installUrl: INSTALL as string | null },
};

vi.mock('@/hooks/api/useGitHub', () => ({
  useGitHub: () => githubState,
}));

vi.mock('@/components/features/onboarding/ConfigFolderForm', () => ({
  ConfigFolderForm: () => <p>Choose the config folder</p>,
}));

const STEPS = [
  {
    key: 'github',
    title: 'Install the GitHub App',
    description: 'So Spotlight can read and write.',
  },
  {
    key: 'harness',
    title: 'Connect a host',
    description: 'A runner with an agent harness installed.',
  },
  {
    key: 'configuration',
    title: 'Set up configuration as code',
    description: 'A repository and folder for the team’s Terraform.',
  },
];

const onboarding = (
  over: Record<string, unknown> = {},
  done: string[] = [],
) => ({
  steps: STEPS.map((step) => ({ ...step, done: done.includes(step.key) })),
  canSetUp: done.includes('github') && done.includes('harness'),
  viewerIsAdmin: true,
  setupChat: null,
  ...over,
});

const CI = {
  defaultBranch: 'main',
  defaultBranchProtected: true,
  variables: 'written',
};

const chat = (over: Record<string, unknown> = {}) => ({
  id: 'chat_setup',
  repository: 'acme/infra',
  pullRequest: null,
  ci: null,
  startedBy: 'Sam',
  ...over,
});

const BODY = '1. Install the GitHub App. So Spotlight can read and write.';

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
  onboardingState.errorUpdateCount = 0;
  refetch.mockReset();
  githubState.data = { connected: false, installUrl: INSTALL };
});

describe('SetupSteps', () => {
  it('keeps the steps’ place while they load, under the heading it already has', () => {
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
    expect(screen.getByRole('link', { name: 'Go to runners' })).toHaveAttribute(
      'href',
      '/w/acme/settings/runners',
    );
  });

  it('offers to configure the App once it is installed', async () => {
    githubState.data = { connected: true, installUrl: INSTALL };
    onboardingState.data = onboarding({}, ['github']);
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: /Install the GitHub App/ }),
    );

    expect(
      screen.getByRole('link', { name: 'Configure on GitHub' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Install on GitHub' }),
    ).not.toBeInTheDocument();
  });

  it('collapses a done step, keeping the next one open', () => {
    githubState.data = { connected: true, installUrl: INSTALL };
    onboardingState.data = onboarding({}, ['github']);
    showing();

    expect(
      screen.getByRole('button', { name: /Install the GitHub App/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('link', { name: 'Go to runners' }),
    ).toBeInTheDocument();
  });

  it('shows no install control where GitHub would not say', () => {
    githubState.data = { connected: false, installUrl: null };
    onboardingState.data = onboarding();
    showing();

    expect(
      screen.queryByRole('link', { name: 'Install on GitHub' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Install the GitHub App')).toBeInTheDocument();
  });

  it('shows the opening heading and text itself', () => {
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

  it('collapses the harness step once a runner reports one', () => {
    onboardingState.data = onboarding({}, ['harness']);
    showing();

    expect(
      screen.getByRole('button', { name: /Connect a host/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('link', { name: 'Install on GitHub' }),
    ).toBeInTheDocument();
  });

  it('says the steps could not be loaded, and offers to try again', async () => {
    onboardingState.data = undefined;
    onboardingState.errorUpdateCount = 1;
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The setup steps could not be loaded.',
    );
    expect(screen.getByText('Set up your team')).toBeInTheDocument();
    expect(screen.queryByText(BODY)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('falls back to the words it was written with', () => {
    onboardingState.data = undefined;
    showing();

    expect(screen.getByText(BODY)).toBeInTheDocument();
  });

  it('locks every control once the item is resolved', () => {
    githubState.data = { connected: true, installUrl: INSTALL };
    onboardingState.data = onboarding({}, ['github', 'harness']);
    showing(true);

    const install = screen.getByRole('link', { name: 'Configure on GitHub' });
    expect(install.closest('[inert]')).not.toBeNull();
  });

  it('leaves the controls usable while the item is unresolved', () => {
    onboardingState.data = onboarding();
    showing(false);

    const install = screen.getByRole('link', { name: 'Install on GitHub' });
    expect(install.closest('[inert]')).toBeNull();
  });

  it('offers the config folder once GitHub and a host are ready', () => {
    onboardingState.data = onboarding({}, ['github', 'harness']);
    showing();

    expect(screen.getByText('Choose the config folder')).toBeInTheDocument();
  });

  it('says what setting up configuration waits on', () => {
    onboardingState.data = onboarding({}, ['github']);
    showing();

    expect(screen.queryByText('Choose the config folder')).toBeNull();
    expect(
      screen.getByText(/The setup chat needs the GitHub App and egress\./),
    ).toBeInTheDocument();
  });

  it('waits on egress where no host or push pool with egress runs', () => {
    onboardingState.data = onboarding({ canSetUp: false }, [
      'github',
      'harness',
    ]);
    showing();

    expect(screen.queryByText('Choose the config folder')).toBeNull();
    expect(
      screen.getByText(/name an egress in a push pool\./),
    ).toBeInTheDocument();
  });

  it('names who is setting the team up in a chat only they can open', () => {
    onboardingState.data = onboarding(
      { setupChat: chat({ id: null, startedBy: 'Grace' }) },
      ['github', 'harness'],
    );
    showing();

    expect(screen.getByText('Grace is setting this up.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open setup chat' })).toBeNull();
    expect(screen.queryByText('Choose the config folder')).toBeNull();
  });

  it('leads back to the setup chat while it works', () => {
    onboardingState.data = onboarding(
      {
        setupChat: chat(),
      },
      ['github', 'harness'],
    );
    showing();

    expect(
      screen.getByRole('link', { name: 'Open setup chat' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/agent/chat_setup');
  });

  it('leads to the pull request once the setup chat opened it', async () => {
    onboardingState.data = onboarding(
      {
        setupChat: chat({
          pullRequest: 'https://github.com/acme/infra/pull/12',
        }),
      },
      ['github', 'harness', 'configuration'],
    );
    showing(true);

    await userEvent.click(
      screen.getByRole('button', { name: /Set up configuration as code/ }),
    );

    expect(
      screen.getByRole('link', { name: 'Open pull request' }),
    ).toHaveAttribute('href', 'https://github.com/acme/infra/pull/12');
    expect(
      screen
        .getByRole('link', { name: 'Open pull request' })
        .closest('[inert]'),
    ).toBeNull();
  });

  it('keeps the setup to workspace owners and admins', () => {
    onboardingState.data = onboarding({ viewerIsAdmin: false }, [
      'github',
      'harness',
    ]);
    showing();

    expect(screen.queryByText('Choose the config folder')).toBeNull();
    expect(
      screen.getByText(
        'Only a workspace owner or admin can set up configuration as code.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a member who is setting the team up', () => {
    onboardingState.data = onboarding(
      { viewerIsAdmin: false, setupChat: chat({ id: null }) },
      ['github', 'harness'],
    );
    showing();

    expect(screen.getByText('Sam is setting this up.')).toBeInTheDocument();
  });

  it('says what GitHub Actions may do once the setup created its trusts', () => {
    onboardingState.data = onboarding({ setupChat: chat({ ci: CI }) }, [
      'github',
      'harness',
    ]);
    showing();

    expect(
      screen.getByText(/GitHub Actions: pull requests in/),
    ).toHaveTextContent(
      'GitHub Actions: pull requests in acme/infra plan, and pushes to main apply.',
    );
    expect(
      screen.queryByText(
        'Add the repository variables that the pull request lists.',
      ),
    ).toBeNull();
    expect(
      screen.queryByRole('img', { name: 'main has no branch protection' }),
    ).toBeNull();
  });

  it('keeps what GitHub Actions may do in view after the step is done', () => {
    onboardingState.data = onboarding(
      {
        setupChat: chat({
          pullRequest: 'https://github.com/acme/infra/pull/12',
          ci: CI,
        }),
      },
      ['github', 'harness', 'configuration'],
    );
    showing();

    expect(
      screen.getByText(/GitHub Actions: pull requests in/),
    ).toBeInTheDocument();
  });

  it('asks for the repository variables that the GitHub App may not write', () => {
    onboardingState.data = onboarding(
      { setupChat: chat({ ci: { ...CI, variables: 'not-permitted' } }) },
      ['github', 'harness'],
    );
    showing();

    expect(
      screen.getByText(
        'Add the repository variables that the pull request lists.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'The GitHub App may not write variables. Grant it “Variables: read and write” to let Spotlight set them.',
      ),
    ).toBeInTheDocument();
  });

  it('warns that a default branch without protection can change the configuration', () => {
    onboardingState.data = onboarding(
      { setupChat: chat({ ci: { ...CI, defaultBranchProtected: false } }) },
      ['github', 'harness'],
    );
    showing();

    expect(
      screen.getByRole('img', { name: 'main has no branch protection' }),
    ).toHaveAccessibleDescription(
      'main has no branch protection. Anyone who can push to main can change this workspace’s configuration. Please require a pull request review.',
    );
  });
});
