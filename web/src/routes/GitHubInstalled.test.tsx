import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GitHubInstalled } from '@/routes/GitHubInstalled';

const connect = vi.fn();
const connectState = {
  data: undefined as true | undefined,
  isPending: true,
  isSuccess: false,
  errorUpdateCount: 0,
  error: null as Error | null,
};
vi.mock('@/hooks/api/useConnectGitHub', () => ({
  useConnectGitHub: (slug: string | undefined, id: string | null) => {
    connect(slug, id);
    return connectState;
  },
}));

const renderAt = (query: string) =>
  render(
    <MemoryRouter initialEntries={[`/github/installed${query}`]}>
      <Routes>
        <Route path="/github/installed" element={<GitHubInstalled />} />
        <Route path="/" element={<p>the beginning</p>} />
        <Route path="/w/acme/inbox/i_1" element={<p>the inbox item</p>} />
        <Route
          path="/w/acme/settings/team/team_1/integrations"
          element={<p>the team integrations</p>}
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  connect.mockReset();
  connectState.data = undefined;
  connectState.isPending = true;
  connectState.isSuccess = false;
  connectState.errorUpdateCount = 0;
  connectState.error = null;
});

describe('GitHubInstalled', () => {
  it('tells the control-plane which installation was made', () => {
    renderAt('?installation_id=42&state=acme%3Ateam_1');

    expect(connect).toHaveBeenCalledWith('acme', '42');
  });

  it('puts the person back on the page they left', () => {
    connectState.isSuccess = true;
    renderAt(
      `?installation_id=42&state=${encodeURIComponent(`acme:team_1:${encodeURIComponent('/w/acme/inbox/i_1')}`)}`,
    );

    expect(screen.getByText('the inbox item')).toBeInTheDocument();
  });

  it('falls back to the integrations page', () => {
    connectState.isSuccess = true;
    renderAt('?installation_id=42&state=acme%3Ateam_1');

    expect(screen.getByText('the team integrations')).toBeInTheDocument();
  });

  it('connects nothing when the App was only requested', () => {
    renderAt('?setup_action=request&installation_id=42&state=acme%3Ateam_1');

    expect(connect).toHaveBeenCalledWith('acme', null);
    expect(screen.getByText('Approval requested')).toBeInTheDocument();
  });

  it('says so when the control plane denies the installation', () => {
    connectState.isPending = false;
    connectState.errorUpdateCount = 1;
    connectState.error = new Error(
      'That is not an installation you administer on GitHub',
    );

    renderAt('?installation_id=42&state=acme%3Ateam_1');

    expect(
      screen.getByRole('heading', {
        name: 'Sorry, the GitHub App couldn’t connect',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Please try again in a few minutes/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Back to the team/ }),
    ).toBeInTheDocument();
  });

  it('goes back to the beginning with no idea where it came from', () => {
    renderAt('?installation_id=42');

    expect(screen.getByText('the beginning')).toBeInTheDocument();
  });
});
