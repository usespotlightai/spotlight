import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamSettings } from '@/routes/TeamSettings';

const workspace = vi.fn();
const members = vi.fn();
const rename = vi.fn();

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({ data: workspace() }),
}));

vi.mock('@/hooks/api/useMembers', () => ({
  useMembers: () => ({ data: members() }),
}));

vi.mock('@/hooks/api/useRenameTeam', () => ({
  useRenameTeam: () => ({ mutate: rename, isPending: false }),
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
  rename.mockReset();
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

  it('renders nothing until the team is known', () => {
    workspace.mockReturnValue(undefined);
    const { container } = showing();

    expect(container).toBeEmptyDOMElement();
  });
});
