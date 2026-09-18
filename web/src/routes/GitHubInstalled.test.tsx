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

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

const renderAt = (query: string) =>
  render(
    <MemoryRouter initialEntries={[`/github/installed${query}`]}>
      <Routes>
        <Route path="/github/installed" element={<GitHubInstalled />} />
        <Route path="/" element={<p>the beginning</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  connect.mockReset();
  navigate.mockReset();
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

    expect(navigate).toHaveBeenCalledWith('/w/acme/inbox/i_1', {
      replace: true,
    });
  });

  it('falls back to the integrations page', () => {
    connectState.isSuccess = true;
    renderAt('?installation_id=42&state=acme%3Ateam_1');

    expect(navigate).toHaveBeenCalledWith(
      '/w/acme/team/team_1/settings/integrations',
      {
        replace: true,
      },
    );
  });

  it('connects nothing when the App was only requested', () => {
    renderAt('?setup_action=request&installation_id=42&state=acme%3Ateam_1');

    expect(connect).toHaveBeenCalledWith('acme', null);
    expect(screen.getByText('Asked for on your behalf')).toBeInTheDocument();
  });

  it('says so when the control-plane refused', () => {
    connectState.isPending = false;
    connectState.errorUpdateCount = 1;
    connectState.error = new Error(
      'That is not an installation you administer on GitHub',
    );

    renderAt('?installation_id=42&state=acme%3Ateam_1');

    expect(
      screen.getByRole('heading', { name: 'Something went wrong' }),
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
