import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ConfigFolderForm } from '@/components/features/onboarding/ConfigFolderForm';

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({
    data: [{ fullName: 'acme/api' }, { fullName: 'acme/infra' }],
  }),
}));

function HandedOver() {
  const location = useLocation();

  return <pre data-testid="handed">{JSON.stringify(location.state)}</pre>;
}

const showing = () =>
  render(
    <MemoryRouter initialEntries={['/acme/teams/team_1']}>
      <Routes>
        <Route
          path="/acme/teams/team_1"
          element={<ConfigFolderForm slug="acme" teamId="team_1" />}
        />
        <Route path="*" element={<HandedOver />} />
      </Routes>
    </MemoryRouter>,
  );

describe('ConfigFolderForm', () => {
  it('waits for the team’s repositories before it continues in chat', async () => {
    const user = userEvent.setup();
    showing();

    await user.click(screen.getByRole('button', { name: /^Repository:/ }));
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'acme/infra' }),
    );

    expect(
      screen.getByRole('button', { name: 'Repositories' }),
    ).toHaveTextContent('Repositories your team works in');
    expect(
      screen.getByRole('button', { name: 'Continue in chat' }),
    ).toBeDisabled();
  });

  it('waits for a repository before it continues in chat', () => {
    showing();

    expect(
      screen.getByRole('button', { name: 'Continue in chat' }),
    ).toBeDisabled();
  });

  it('hands the message, the setup and the team’s repositories to a new chat', async () => {
    const user = userEvent.setup();
    showing();

    await user.click(screen.getByRole('button', { name: /^Repository:/ }));
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'acme/infra' }),
    );
    await user.clear(screen.getByRole('textbox', { name: 'Folder' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Folder' }),
      'infra/spotlight',
    );
    await user.click(screen.getByRole('button', { name: 'Repositories' }));
    await user.click(
      await screen.findByRole('menuitemcheckbox', { name: 'acme/api' }),
    );
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Continue in chat' }));

    expect(
      JSON.parse(screen.getByTestId('handed').textContent ?? 'null'),
    ).toMatchObject({
      prompt:
        'Set up our configuration as code in acme/infra, under infra/spotlight/.',
      setup: { repository: 'acme/infra', folder: 'infra/spotlight' },
      repositories: ['acme/api'],
    });
  });
});
