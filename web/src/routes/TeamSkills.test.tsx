import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamSkills } from '@/routes/TeamSkills';

const skills = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useTeamSkills', () => ({
  useTeamSkills: () => ({
    data: skills(),
    isPending: skills() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

const GRAFANA = {
  key: 'grafana-dashboards',
  description: 'Reading this team’s dashboards.',
  path: '.spotlight/skills/grafana-dashboards',
};

const showing = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1/settings/skills']}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/settings/skills"
          element={<TeamSkills />}
        />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  skills.mockReturnValue({ skills: [GRAFANA] });
  failing.mockReturnValue(false);
  refetch.mockClear();
});

describe('TeamSkills', () => {
  it('lists the team’s skills by name and what each is for', () => {
    showing();

    expect(screen.getByText('grafana-dashboards')).toBeInTheDocument();
    expect(
      screen.getByText('Reading this team’s dashboards.'),
    ).toBeInTheDocument();
  });

  it('says where each skill is defined, and offers nothing to edit here', () => {
    showing();

    expect(
      screen.getByText('.spotlight/skills/grafana-dashboards'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('holds the shape of a skill while they load, keeping what never changes', () => {
    skills.mockReturnValue(undefined);
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the skills' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.queryByText(/defines no skills/)).not.toBeInTheDocument();
  });

  it('says so where the team keeps none', () => {
    skills.mockReturnValue({ skills: [] });
    showing();

    expect(
      screen.getByText('This team defines no skills yet.'),
    ).toBeInTheDocument();
  });

  it('says the skills could not be loaded, rather than that there are none, and tries again when asked', async () => {
    const person = userEvent.setup();
    skills.mockReturnValue(undefined);
    failing.mockReturnValue(true);
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Skills could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/defines no skills/)).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });
});
