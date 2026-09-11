import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamSettings } from '@/routes/TeamSettings';

const workspace = vi.fn();
const members = vi.fn();
const rename = vi.fn();
const configuration = vi.fn();
const onboarding = vi.fn();
const move = vi.fn();
const moved = vi.fn();

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({ data: workspace() }),
}));

vi.mock('@/hooks/api/useMembers', () => ({
  useMembers: () => ({ data: members() }),
}));

vi.mock('@/hooks/api/useRenameTeam', () => ({
  useRenameTeam: () => ({ mutate: rename, isPending: false }),
}));

vi.mock('@/hooks/api/useConfiguration', () => ({
  useConfiguration: () => ({ data: configuration() }),
}));

vi.mock('@/hooks/api/useOnboarding', () => ({
  useOnboarding: () => ({ data: onboarding() }),
}));

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({
    data: [{ fullName: 'acme/api' }, { fullName: 'acme/config' }],
  }),
}));

vi.mock('@/hooks/api/useMoveConfiguration', () => ({
  useMoveConfiguration: () => ({
    mutate: move,
    reset: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...moved(),
  }),
}));

const showing = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1/settings']}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/settings"
          element={<TeamSettings />}
        />
      </Routes>
    </MemoryRouter>,
  );

const moving = async () =>
  userEvent.click(screen.getByRole('button', { name: 'Move configuration' }));

beforeEach(() => {
  workspace.mockReturnValue({
    id: 'ws_1',
    name: 'Acme',
    slug: 'acme',
    teams: [{ id: 'team_1', name: 'Platform' }],
  });
  members.mockReturnValue([
    { id: 'user_1', name: 'Leon Liang', image: null },
    { id: 'user_2', name: 'Ada Lovelace', image: null },
  ]);
  configuration.mockReturnValue({
    repository: 'acme/config',
    readsFrom: 'acme/config',
    movingTo: null,
  });
  onboarding.mockReturnValue({
    connectedToGitHub: true,
    repositoryOwner: 'acme',
  });
  moved.mockReturnValue({ isSuccess: false, data: undefined });
  rename.mockReset();
  move.mockReset();
});

describe('TeamSettings', () => {
  it('shows the team name', () => {
    showing();

    expect(screen.getByLabelText('Team name')).toHaveValue('Platform');
  });

  it('renames the team once edited and left', async () => {
    showing();

    const field = screen.getByLabelText('Team name');
    await userEvent.clear(field);
    await userEvent.type(field, 'Platform Team');
    await userEvent.tab();

    expect(rename).toHaveBeenCalledWith('Platform Team', expect.anything());
  });

  it('does not rename when the name is left unchanged', async () => {
    showing();

    const field = screen.getByLabelText('Team name');
    await userEvent.click(field);
    await userEvent.tab();

    expect(rename).not.toHaveBeenCalled();
  });

  it('lists the members with a count', () => {
    showing();

    expect(
      screen.getByRole('heading', { name: /Members\s*2/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Leon Liang')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('says so when the team has no members', () => {
    members.mockReturnValue([]);
    showing();

    expect(screen.getByText('No one is on this team yet.')).toBeInTheDocument();
  });

  it('shows the repository the team reads its configuration from', () => {
    showing();

    expect(screen.getByText('acme/config')).toBeInTheDocument();
    // No field until the pencil is clicked; the value is read-only.
    expect(screen.queryByLabelText('Repository')).not.toBeInTheDocument();
  });

  it('says where the configuration is moving while that is under way', () => {
    configuration.mockReturnValue({
      repository: 'acme/config',
      readsFrom: 'acme/config',
      movingTo: 'acme/other',
    });
    showing();

    expect(screen.getByText('acme/config')).toBeInTheDocument();
    expect(
      screen.getByText('Moving to acme/other once its pull request merges.'),
    ).toBeInTheDocument();
  });

  it('moves the configuration to the repository named', async () => {
    showing();

    await moving();

    // The owner is shown apart, so the field holds only the name.
    await userEvent.type(screen.getByLabelText('Repository'), 'other');
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));

    expect(move).toHaveBeenCalledWith('acme/other');
  });

  it('links the pull request that carries the configuration', async () => {
    moved.mockReturnValue({
      isSuccess: true,
      data: {
        kind: 'carried',
        url: 'https://github.com/acme/other/pull/4',
      },
      variables: 'acme/other',
    });
    showing();

    await moving();

    expect(
      screen.getByRole('link', { name: 'View pull request' }),
    ).toHaveAttribute('href', 'https://github.com/acme/other/pull/4');
    expect(
      screen.getByText(/The team reads from there once it merges\./),
    ).toBeInTheDocument();
  });

  it('says a repository already holding configuration is read from now', async () => {
    moved.mockReturnValue({
      isSuccess: true,
      data: { kind: 'adopted', url: null },
      variables: 'acme/other',
    });
    showing();

    await moving();

    expect(
      screen.getByText(
        'acme/other already holds Spotlight configuration, so this team reads from it now. Nothing was written over it.',
      ),
    ).toBeInTheDocument();
  });

  it('asks to connect GitHub before a repository can be chosen', () => {
    onboarding.mockReturnValue({
      connectedToGitHub: false,
      repositoryOwner: null,
    });
    showing();

    expect(
      screen.queryByRole('button', { name: 'Move configuration' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Connect GitHub to choose one.'),
    ).toBeInTheDocument();
  });

  it('renders nothing until the team is known', () => {
    workspace.mockReturnValue(undefined);
    const { container } = showing();

    expect(container).toBeEmptyDOMElement();
  });
});
