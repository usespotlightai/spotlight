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
];

const onboarding = (
  over: Record<string, unknown> = {},
  done: string[] = [],
) => ({
  steps: STEPS.map((step) => ({ ...step, done: done.includes(step.key) })),
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

  it('folds a done step away, keeping the next one open', () => {
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

  it('folds the harness step away once a runner reports one', () => {
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
});
