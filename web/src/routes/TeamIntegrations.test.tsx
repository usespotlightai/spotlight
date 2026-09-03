import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
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
  useOnboarding: () => ({ data: onboarding() }),
  useChooseTools: () => ({ mutate: choose, isPending: false }),
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

const ready = (over: Record<string, unknown> = {}) => ({
  hasRunner: true,
  connectedToGitHub: true,
  hasConfiguration: true,
  tools: [tool()],
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

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(
      screen.getByRole('button', { name: 'Write the configuration' }),
    );

    expect(choose).toHaveBeenCalledWith(['linear'], expect.anything());
  });

  // Already written is not a thing to choose again.
  it('does not offer one already written', () => {
    onboarding.mockReturnValue(ready({ tools: [tool({ chosen: true })] }));
    configuration.mockReturnValue(read());
    showing();

    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText('already written')).toBeInTheDocument();
  });

  // Each of these is something a person has to go and do somewhere else.
  it('says what is still needed before any of it does anything', () => {
    onboarding.mockReturnValue(
      ready({ hasRunner: false, hasConfiguration: false }),
    );
    configuration.mockReturnValue(read());
    showing();

    expect(screen.getByText('Start a runner')).toBeInTheDocument();
    expect(
      screen.getByText('Merge the opening pull request'),
    ).toBeInTheDocument();
  });

  it('says nothing of prerequisites once they are all done', () => {
    onboarding.mockReturnValue(ready());
    configuration.mockReturnValue(read());
    showing();

    expect(screen.queryByText('Start a runner')).not.toBeInTheDocument();
  });

  // There is nowhere to write it until the App is installed.
  it('will not write anything before GitHub is connected', () => {
    onboarding.mockReturnValue(ready({ connectedToGitHub: false }));
    configuration.mockReturnValue(read());
    showing();

    expect(
      screen.getByRole('button', { name: 'Write the configuration' }),
    ).toBeDisabled();
    expect(screen.getByText(/nowhere to write it yet/)).toBeInTheDocument();
  });

  it('shows what is wrong with the files', () => {
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

    expect(screen.getByText('1 problem to fix')).toBeInTheDocument();
  });
});
