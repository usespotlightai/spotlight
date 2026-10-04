import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
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
};

const showing = (hash = '') =>
  render(
    <MemoryRouter
      initialEntries={[`/w/acme/settings/team/team_1/skills${hash}`]}
    >
      <Routes>
        <Route
          path="/w/:slug/settings/team/:teamId/skills"
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
  it('scrolls to the skill a link names, so Insights can point at one', () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;

    showing('#skill-grafana-dashboards');

    expect(document.getElementById('skill-grafana-dashboards')).toHaveAttribute(
      'data-slot',
      'team-skill',
    );
    expect(document.getElementById('skill-grafana-dashboards')).toHaveAttribute(
      'data-pointed',
    );
    expect(scrolled).toHaveBeenCalledWith({ block: 'center' });
  });

  it('marks the skill a link points at after moving there within the app', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(
      <MemoryRouter initialEntries={['/w/acme/settings/team/team_1/skills']}>
        <Routes>
          <Route
            path="/w/:slug/settings/team/:teamId/skills"
            element={
              <>
                <TeamSkills />
                <Link to="#skill-grafana-dashboards">Point at it</Link>
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      document.getElementById('skill-grafana-dashboards'),
    ).not.toHaveAttribute('data-pointed');

    await userEvent.click(screen.getByRole('link', { name: 'Point at it' }));

    expect(document.getElementById('skill-grafana-dashboards')).toHaveAttribute(
      'data-pointed',
    );
  });

  it('lists the team’s skills by name and what each is for', () => {
    showing();

    expect(screen.getByText('grafana-dashboards')).toBeInTheDocument();
    expect(
      screen.getByText('Reading this team’s dashboards.'),
    ).toBeInTheDocument();
  });

  it('names each skill without its folder, and offers nothing to edit here', () => {
    showing();

    expect(screen.getByText('grafana-dashboards')).toBeInTheDocument();
    expect(screen.queryByText(/\.spotlight\/skills\//)).not.toBeInTheDocument();
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
