import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamSkills } from '@/routes/TeamSkills';

const skills = vi.fn();
const failed = vi.fn();

vi.mock('@/hooks/api/useTeamSkills', () => ({
  useTeamSkills: () => ({
    data: skills(),
    isPending: false,
    isError: failed(),
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
  skills.mockReturnValue({ repository: 'acme/config', skills: [GRAFANA] });
  failed.mockReturnValue(false);
});

describe('TeamSkills', () => {
  it('lists the team’s skills by name and what each is for', () => {
    showing();

    expect(screen.getByText('grafana-dashboards')).toBeInTheDocument();
    expect(
      screen.getByText('Reading this team’s dashboards.'),
    ).toBeInTheDocument();
  });

  it('configures a skill on GitHub, and offers nothing to edit here', () => {
    showing();

    expect(
      screen.getByRole('link', {
        name: 'Configure grafana-dashboards on GitHub',
      }),
    ).toHaveAttribute(
      'href',
      'https://github.com/acme/config/tree/HEAD/.spotlight/skills/grafana-dashboards',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('says how to add a skill where the team keeps none', () => {
    skills.mockReturnValue({ repository: 'acme/config', skills: [] });
    showing();

    expect(
      screen.getByText(/No skills yet\. Add a folder with a SKILL\.md/),
    ).toHaveTextContent('in acme/config');
  });

  it('says the skills could not be loaded, rather than that there are none', () => {
    skills.mockReturnValue(undefined);
    failed.mockReturnValue(true);
    showing();

    expect(
      screen.getByText('Skills could not be loaded. Try again.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No skills yet/)).not.toBeInTheDocument();
  });
});
