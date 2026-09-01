import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamNav } from '@/components/layout/TeamNav';

vi.mock('@/hooks/api/useAssemblyLines', () => ({
  useAssemblyLines: () => ({
    data: [{ id: 'line_1', name: 'Default', stations: [] }],
    isPending: false,
  }),
}));
vi.mock('@/hooks/api/useTasks', () => ({
  useTasks: () => ({ data: [], isPending: false }),
}));

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

const row = (team: string) => screen.getByRole('button', { name: team });

const panels = () =>
  Array.from(document.querySelectorAll('[data-slot="team-sections"]'));

const lineGroups = () =>
  Array.from(document.querySelectorAll('[data-slot="assembly-lines"]'));

const linesRow = (index: number) =>
  screen.getAllByRole('button', { name: /Assembly lines/ })[index];

beforeEach(() => {
  localStorage.clear();
});

describe('TeamNav', () => {
  it('lists every team under a heading', () => {
    renderNav();

    expect(
      screen.getByRole('heading', { name: 'Your teams' }),
    ).toBeInTheDocument();
    expect(row('Platform')).toBeInTheDocument();
    expect(row('Örebro Co')).toBeInTheDocument();
  });

  it('starts expanded so the sections are discoverable', () => {
    renderNav();

    expect(panels()).toHaveLength(teams.length);
    for (const panel of panels()) {
      expect(panel).toHaveAttribute('data-open', 'true');
    }
    expect(row('Platform')).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps a collapsed team out of the tab order', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(row('Platform'));

    expect(panels()[0]?.querySelector('ul')).toHaveAttribute('inert');
    expect(panels()[1]?.querySelector('ul')).not.toHaveAttribute('inert');
  });

  it('groups a team’s assembly lines under a row of their own', () => {
    renderNav();

    expect(lineGroups()).toHaveLength(teams.length);
    expect(screen.getAllByRole('link', { name: 'Default' })).toHaveLength(
      teams.length,
    );
    expect(linesRow(0)).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes one team’s line group without touching the other', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(linesRow(0) as HTMLElement);

    expect(linesRow(0)).toHaveAttribute('aria-expanded', 'false');
    expect(linesRow(1)).toHaveAttribute('aria-expanded', 'true');
    expect(lineGroups()[0]?.querySelector('ul')).toHaveAttribute('inert');
    expect(lineGroups()[1]?.querySelector('ul')).not.toHaveAttribute('inert');
  });

  it('remembers a closed line group across mounts', async () => {
    const user = userEvent.setup();
    const { unmount } = renderNav();

    await user.click(linesRow(0) as HTMLElement);
    unmount();

    renderNav();

    expect(linesRow(0)).toHaveAttribute('aria-expanded', 'false');
  });

  it('only opens and closes, leaving the page where it is', () => {
    renderNav();

    expect(row('Platform')).not.toHaveAttribute('href');
    expect(row('Platform').tagName).toBe('BUTTON');
  });

  it('collapses and expands one team without touching the other', async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(row('Platform'));

    expect(row('Platform')).toHaveAttribute('aria-expanded', 'false');
    expect(row('Örebro Co')).toHaveAttribute('aria-expanded', 'true');
    expect(panels()[0]).not.toHaveAttribute('data-open');
    expect(panels()[1]).toHaveAttribute('data-open', 'true');

    await user.click(row('Platform'));

    expect(panels()[0]).toHaveAttribute('data-open', 'true');
  });

  it('remembers what was collapsed across mounts', async () => {
    const user = userEvent.setup();
    const { unmount } = renderNav();

    await user.click(row('Platform'));
    unmount();

    renderNav();

    expect(row('Platform')).toHaveAttribute('aria-expanded', 'false');
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
