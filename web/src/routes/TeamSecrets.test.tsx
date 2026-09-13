import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamSecrets } from '@/routes/TeamSecrets';

const revealed = vi.fn();

vi.mock('@/hooks/api/useRevealVaultKey', async () => {
  const { useState } = await import('react');

  return {
    useRevealVaultKey: () => {
      const [asked, setAsked] = useState(false);

      return {
        ...(asked ? revealed() : { data: undefined, isError: false }),
        isPending: false,
        mutate: () => setAsked(true),
      };
    },
  };
});

const showing = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1/settings/secrets']}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/settings/secrets"
          element={<TeamSecrets />}
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  revealed.mockReturnValue({ data: { key: 'the-vault-key' }, isError: false });
});

describe('TeamSecrets', () => {
  it('keeps the vault key hidden until it is revealed', async () => {
    const user = userEvent.setup();
    showing();

    expect(screen.queryByText('the-vault-key')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reveal' }));

    expect(await screen.findByText('the-vault-key')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy the vault key' }),
    ).toBeInTheDocument();
  });

  it('tells somebody who is no owner or admin the key is not theirs to see', async () => {
    const user = userEvent.setup();
    revealed.mockReturnValue({ data: null, isError: false });
    showing();

    await user.click(screen.getByRole('button', { name: 'Reveal' }));

    expect(
      screen.getByText('Only owners and admins can see the vault key.'),
    ).toBeInTheDocument();
  });

  it('says the key could not be loaded when revealing it fails otherwise', async () => {
    const user = userEvent.setup();
    revealed.mockReturnValue({ data: undefined, isError: true });
    showing();

    await user.click(screen.getByRole('button', { name: 'Reveal' }));

    expect(
      screen.getByText('The vault key could not be loaded. Try again.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Only owners and admins can see the vault key.'),
    ).not.toBeInTheDocument();
  });
});
