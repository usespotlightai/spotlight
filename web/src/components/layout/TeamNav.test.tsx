import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { TeamNav } from '@/components/layout/TeamNav';

const teams = [
  { id: 'team_1', name: 'Platform' },
  { id: 'team_2', name: 'Örebro Co' },
];

const renderNav = (path = '/w/acme-inc') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TeamNav slug="acme-inc" teams={teams} />
    </MemoryRouter>,
  );

const chevron = (team: string) =>
  screen.getByRole('button', { name: new RegExp(`(Collapse|Expand) ${team}`) });

const panels = () =>
  Array.from(document.querySelectorAll('[data-slot="team-sections"]'));

beforeEach(() => {
  localStorage.clear();
});

describe('TeamNav', () => {
  it('lists every team under a heading', () => {
    renderNav();

    expect(
      screen.getByRole('heading', { name: 'Your teams' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Platform' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Örebro Co' })).toBeInTheDocument();
  });

  it('starts expanded so the sections are discoverable', () => {
    renderNav();

    expect(panels()).toHaveLength(teams.length);
    for (const panel of panels()) {
      expect(panel).toHaveAttribute('data-open', 'true');
    }
    expect(chevron('Platform')).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps a collapsed team out of the tab order', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(chevron('Platform'));

    expect(panels()[0]?.querySelector('ul')).toHaveAttribute('inert');
    expect(panels()[1]?.querySelector('ul')).not.toHaveAttribute('inert');
  });

  it('points a team at its first section', () => {
    renderNav();

    expect(screen.getByRole('link', { name: 'Platform' })).toHaveAttribute(
      'href',
      '/w/acme-inc/team/team_1/lines',
    );
  });

  it('collapses and expands one team without touching the other', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(chevron('Platform'));

    expect(chevron('Platform')).toHaveAttribute('aria-expanded', 'false');
    expect(chevron('Örebro Co')).toHaveAttribute('aria-expanded', 'true');
    expect(panels()[0]).not.toHaveAttribute('data-open');
    expect(panels()[1]).toHaveAttribute('data-open', 'true');

    await user.click(chevron('Platform'));

    expect(panels()[0]).toHaveAttribute('data-open', 'true');
  });

  it('opens a collapsed team when its row is clicked, not just the chevron', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(chevron('Platform'));
    expect(chevron('Platform')).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('link', { name: 'Platform' }));

    expect(chevron('Platform')).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes an open team when its row is clicked', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole('link', { name: 'Platform' }));

    expect(chevron('Platform')).toHaveAttribute('aria-expanded', 'false');
    expect(chevron('Örebro Co')).toHaveAttribute('aria-expanded', 'true');
  });

  it('remembers what was collapsed across mounts', async () => {
    const user = userEvent.setup();
    const { unmount } = renderNav();

    await user.click(chevron('Platform'));
    unmount();

    renderNav();

    expect(chevron('Platform')).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks the team whose section is open, and only that section', () => {
    renderNav('/w/acme-inc/team/team_2/runs');

    const rows = document.querySelectorAll('[data-slot="team-row"]');

    expect(rows[0]).not.toHaveAttribute('data-active');
    expect(rows[1]).toHaveAttribute('data-active', 'true');

    const [platformRuns, orebroRuns] = screen.getAllByRole('link', {
      name: 'Runs',
    });

    expect(platformRuns).not.toHaveAttribute('aria-current');
    expect(orebroRuns).toHaveAttribute('aria-current', 'page');
  });
});
