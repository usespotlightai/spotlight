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
    { id: '42', account: 'acme', usedElsewhere: false, usedBy: null },
    { id: '7', account: 'leon', usedElsewhere: false, usedBy: null },
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

  it('marks an installation another workspace uses, names it, and does not connect it', async () => {
    installations.data = [
      {
        id: '42',
        account: 'usespotlightai',
        usedElsewhere: true,
        usedBy: 'Tidepool Labs',
      },
      { id: '7', account: 'leon', usedElsewhere: false, usedBy: null },
    ];
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Connect GitHub' }),
    );

    const used = await screen.findByRole('menuitem', {
      name: 'usespotlightai Used by Tidepool Labs',
    });
    expect(used).toHaveAttribute('aria-disabled', 'true');
    expect(used).toHaveAccessibleDescription(
      'An installation serves one workspace. Install on another account to connect this workspace.',
    );

    await userEvent.click(used);

    expect(connect.mutate).not.toHaveBeenCalled();
  });

  it('marks an installation a workspace the person can’t see uses, without naming it', async () => {
    installations.data = [
      { id: '42', account: 'acme', usedElsewhere: true, usedBy: null },
    ];
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Connect GitHub' }),
    );

    expect(
      await screen.findByRole('menuitem', {
        name: 'acme Used by another workspace',
      }),
    ).toHaveAttribute('aria-disabled', 'true');
  });

  it('says nothing about other workspaces where every installation is free', async () => {
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'Connect GitHub' }),
    );
    await screen.findByRole('menuitem', { name: 'acme' });

    expect(screen.queryByText(/Used by/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/An installation serves one workspace/),
    ).not.toBeInTheDocument();
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
