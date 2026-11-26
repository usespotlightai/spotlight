import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExistingGitHubInstallations } from '@/components/features/integrations/ExistingGitHubInstallations';

const installations = {
  data: undefined as unknown,
  isPending: false,
  errorUpdateCount: 0,
};
const connect = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null as unknown,
};

vi.mock('@/hooks/api/useGitHubInstallations', () => ({
  useGitHubInstallations: () => installations,
}));

vi.mock('@/hooks/api/useConnectGitHubInstallation', () => ({
  useConnectGitHubInstallation: () => connect,
}));

beforeEach(() => {
  installations.data = [
    { id: '42', account: 'acme' },
    { id: '7', account: 'leon' },
  ];
  installations.isPending = false;
  installations.errorUpdateCount = 0;
  connect.mutate.mockReset();
  connect.isPending = false;
  connect.isError = false;
  connect.error = null;
});

describe('ExistingGitHubInstallations', () => {
  it('connects an installation the person can already reach on GitHub', async () => {
    render(<ExistingGitHubInstallations slug="acme" />);

    expect(
      screen.getByText('Already installed on GitHub? Connect it here.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Connect leon' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Connect acme' }));

    expect(connect.mutate).toHaveBeenCalledWith('42');
  });

  it('says what to do when GitHub shows no installation and doesn’t send the person back', () => {
    installations.data = [];
    render(<ExistingGitHubInstallations slug="acme" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Already installed? If GitHub doesn’t send you back, change the App’s repository access on GitHub and save.',
      ),
    ).toBeInTheDocument();
  });

  it('still says what to do when the installations could not be read', () => {
    installations.data = undefined;
    installations.errorUpdateCount = 1;
    render(<ExistingGitHubInstallations slug="acme" />);

    expect(
      screen.getByText(/If GitHub doesn’t send you back/),
    ).toBeInTheDocument();
  });

  it('shows nothing while it asks GitHub', () => {
    installations.data = undefined;
    installations.isPending = true;
    const { container } = render(<ExistingGitHubInstallations slug="acme" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('says why an installation would not connect', () => {
    connect.isError = true;
    connect.error = {
      message: 'You are not an admin of this GitHub installation.',
    };
    render(<ExistingGitHubInstallations slug="acme" />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'You are not an admin of this GitHub installation.',
    );
  });
});
