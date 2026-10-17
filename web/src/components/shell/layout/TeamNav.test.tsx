import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamNav } from '@/components/shell/layout/TeamNav';

const lines = vi.fn();

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: lines(),
    isPending: lines() === undefined,
    errorUpdateCount: 0,
  }),
}));
const tasks = vi.fn();

vi.mock('@/hooks/api/useTasks', () => ({
  useTasks: () => ({ data: tasks(), isPending: false }),
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
  Array.from(document.querySelectorAll('[data-slot="lines"]'));

const linesOf = (index: number) =>
  screen.getAllByRole('list', { name: 'Lines' })[index] as HTMLElement;

beforeEach(() => {
  localStorage.clear();
  lines.mockReturnValue([{ id: 'line_1', name: 'Default', stations: [] }]);
  tasks.mockReturnValue([]);
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

  it('lists a team’s lines under a label that folds them away, and remembers it', async () => {
    renderNav();

    expect(lineGroups()).toHaveLength(teams.length);
    expect(
      within(linesOf(0)).getByRole('link', { name: 'Default' }),
    ).toHaveAttribute('href', '/w/acme-inc/team/team_1/lines/line_1');

    const [toggle] = screen.getAllByRole('button', { name: 'Lines' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle as HTMLElement);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(lineGroups()[0]).not.toHaveAttribute('data-open');
    expect(lineGroups()[1]).toHaveAttribute('data-open');
    expect(localStorage.getItem('spotlight.collapsed-lines')).toContain(
      'team_1',
    );
  });

  it('shows no lines, and nothing in their place, while a team’s lines load', () => {
    lines.mockReturnValue(undefined);

    renderNav();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Default' }),
    ).not.toBeInTheDocument();
    expect(linesOf(0)).toBeInTheDocument();
  });

  it('marks the line a task is on, on the task and on its trace', () => {
    lines.mockReturnValue([
      { id: 'line_1', name: 'Default', stations: [{ id: 'station_1' }] },
    ]);
    tasks.mockReturnValue([{ id: 'task_1', stationId: 'station_1' }]);

    renderNav('/w/acme-inc/team/team_1/tasks/task_1/trace');

    expect(
      within(linesOf(0)).getByRole('link', { name: 'Default' }),
    ).toHaveClass('font-medium');
    expect(
      within(linesOf(1)).getByRole('link', { name: 'Default' }),
    ).not.toHaveClass('font-medium');
  });

  it('keeps settings out of the team’s sections', () => {
    renderNav();

    expect(
      screen.queryByRole('button', { name: /Settings/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Integrations' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Observability' }),
    ).not.toBeInTheDocument();
  });

  it('orders a team’s sections: agent, lines, runs, insights, memory', () => {
    renderNav();

    const panel = panels()[0] as HTMLElement;
    const named = within(panel)
      .getAllByRole('link')
      .map((link) => link.textContent);

    expect(named).toEqual(['Agent', 'Default', 'Runs', 'Insights', 'Memory']);
    expect(within(panel).getByRole('link', { name: 'Agent' })).toHaveAttribute(
      'href',
      '/w/acme-inc/team/team_1/agent',
    );
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
