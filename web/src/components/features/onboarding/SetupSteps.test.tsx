import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupSteps } from '@/components/features/onboarding/SetupSteps';
import { installUrlFor } from '@/lib/github';

const onboardingState = { data: undefined as unknown };

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

/** The list as the control plane hands it over, which is what this shows. */
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
    where: '/w/acme/team/team_1/integrations',
  },
  {
    key: 'repository',
    title: 'Choose a repository',
    description: 'Where this team works.',
    where: '/w/acme/team/team_1/integrations',
  },
  {
    key: 'configuration',
    title: 'Merge the setup pull request',
    description: 'Nothing is read until you do.',
    where: null,
  },
  {
    key: 'tools',
    title: 'Choose your tools',
    description: 'What this team listens to.',
    where: '/w/acme/team/team_1/integrations',
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
  tools: [{ source: 'linear', chosen: false }],
  ...over,
});

const BODY = '1. Start a runner. The machine that does the work.';

const showing = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/inbox/item_1']}>
      <Routes>
        <Route
          path="/w/:slug/inbox/:itemId"
          element={
            <SetupSteps
              teamId="team_1"
              body={BODY}
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
  pin.mockReset();
});

describe('SetupSteps', () => {
  it('gives each step still to do a control of its own', () => {
    onboardingState.data = onboarding();
    showing();

    expect(screen.getByRole('link', { name: 'Enrol one' })).toHaveAttribute(
      'href',
      '/w/acme/runners',
    );
    // Carrying the page it was clicked from, so that is where GitHub returns.
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
      '/w/acme/team/team_1/integrations',
    );
  });

  // The note is worth coming back to, so what is done is ticked off.
  it('drops the control from a step already done', () => {
    onboardingState.data = onboarding({}, ['runner']);
    showing();

    expect(
      screen.queryByRole('link', { name: 'Enrol one' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Install on GitHub' }),
    ).toBeInTheDocument();
  });

  // Nothing to link to, so the step stands without a control.
  it('shows no install control where GitHub would not say', () => {
    onboardingState.data = onboarding({ installUrl: null });
    showing();

    expect(
      screen.queryByRole('link', { name: 'Install on GitHub' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Install the GitHub App')).toBeInTheDocument();
  });

  // Shown apart, the opening reads as something the person wrote.
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

  it('ticks off picking tools once one is chosen', () => {
    onboardingState.data = onboarding({}, ['tools']);
    showing();

    expect(
      screen.queryByRole('link', { name: 'Choose them' }),
    ).not.toBeInTheDocument();
  });

  // Where the standing cannot be read, the note still says what it said.
  it('falls back to the words it was written with', () => {
    onboardingState.data = undefined;
    showing();

    expect(screen.getByText(BODY)).toBeInTheDocument();
  });

  // Left to the rule that guesses, the pull request lands wherever sorts
  // first, which is nobody's choice.
  it('lets a person say which repository the setup goes in', async () => {
    onboardingState.data = onboarding({ connectedToGitHub: true });
    showing();

    await userEvent.type(screen.getByLabelText('Repository'), 'config');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    // Owner is shown, not typed, so what is sent is the two put together.
    expect(pin).toHaveBeenCalledWith('acme/config');
  });

  // Naming one that is not there yet is how a person asks for it.
  it("takes a name that is on nobody's list", async () => {
    onboardingState.data = onboarding({ connectedToGitHub: true });
    showing();

    await userEvent.type(
      screen.getByLabelText('Repository'),
      'brand-new{Enter}',
    );

    expect(pin).toHaveBeenCalledWith('acme/brand-new');
  });

  // Half a name would make half a repository.
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

  // The repository a team works in is a setting, not a one-off: it stays
  // changeable once chosen, where the other steps' controls drop away.
  it('keeps the repository control after one has been chosen', () => {
    onboardingState.data = onboarding(
      { connectedToGitHub: true, configRepository: 'acme/config' },
      ['repository'],
    );
    showing();

    expect(screen.getByLabelText('Repository')).toHaveValue('config');
  });

  // Narrowed by what is typed, so the list is the ones still worth picking.
  it('suggests the repositories that match what is typed', async () => {
    onboardingState.data = onboarding({ connectedToGitHub: true });
    showing();

    await userEvent.type(screen.getByLabelText('Repository'), 'conf');

    // The owner is already shown, so a suggestion reads as the name alone.
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

  // A name nobody has is still a name, and the list simply goes away.
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
