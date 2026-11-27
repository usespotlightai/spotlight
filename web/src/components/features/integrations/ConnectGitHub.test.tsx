import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectGitHub } from '@/components/features/integrations/ConnectGitHub';

const INSTALL = 'https://github.com/apps/spotlight/installations/new';

const installations = { data: undefined as unknown };
const connect = { mutate: vi.fn(), isPending: false };

vi.mock('@/hooks/api/useGitHubInstallations', () => ({
  useGitHubInstallations: () => installations,
}));

vi.mock('@/hooks/api/useConnectGitHubInstallation', () => ({
  useConnectGitHubInstallation: () => connect,
}));

const showing = () =>
  render(<ConnectGitHub slug="acme" installUrl={INSTALL} className="" />);

beforeEach(() => {
  installations.data = [
    { id: '42', account: 'acme' },
    { id: '7', account: 'leon' },
  ];
  connect.mutate.mockReset();
  connect.isPending = false;
});

describe('ConnectGitHub', () => {
  it('connects an installation the person can already reach on GitHub', async () => {
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Connect GitHub' }),
    );

    expect(
      await screen.findByRole('menuitem', { name: 'leon' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('menuitem', { name: 'acme' }));

    expect(connect.mutate).toHaveBeenCalledWith('42');
  });

  it('still offers to install the App on another account', async () => {
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Connect GitHub' }),
    );

    expect(
      await screen.findByRole('menuitem', {
        name: 'Install on another account',
      }),
    ).toHaveAttribute('href', INSTALL);
  });

  it('installs the App where GitHub shows no installation', () => {
    installations.data = [];
    showing();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Install on GitHub' }),
    ).toHaveAttribute('href', INSTALL);
  });

  it('installs the App while the installations are not read yet', () => {
    installations.data = undefined;
    showing();

    expect(
      screen.getByRole('link', { name: 'Install on GitHub' }),
    ).toHaveAttribute('href', INSTALL);
  });

  it('keeps the menu shut while an installation connects', () => {
    connect.isPending = true;
    showing();

    expect(
      screen.getByRole('button', { name: 'Connect GitHub' }),
    ).toBeDisabled();
  });
});
