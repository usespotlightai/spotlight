import { Package } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import {
  type CommandTarget,
  commandKeywords,
  commandMatch,
  commandShortcut,
  isCommandShortcut,
  lineTargets,
  navigationTargets,
  settingsTargets,
  stationTargets,
  taskTargets,
} from '@/lib/command';
import { world } from '@/mocks/world';
import { PLATFORM_ID } from '@/mocks/world/platform';

const team = { id: PLATFORM_ID, name: 'Platform' };
const teams = [team];
const lines = world().lines[PLATFORM_ID] ?? [];
const tasks = world().tasks[PLATFORM_ID] ?? [];

describe('navigationTargets', () => {
  it('opens each team section with the team as context', () => {
    const memory = navigationTargets('acme', teams).find(
      (each) => each.id === `team:${PLATFORM_ID}:memory`,
    );

    expect(memory).toMatchObject({
      label: 'Go to Memory',
      context: 'Platform',
      to: `/w/acme/team/${PLATFORM_ID}/memory`,
    });
  });
});

describe('lineTargets', () => {
  it('opens each line board with the team as context', () => {
    const [line] = lines;

    expect(lineTargets('acme', team, lines)[0]).toMatchObject({
      label: line?.name,
      context: 'Platform',
      to: `/w/acme/team/${PLATFORM_ID}/lines/${line?.id}`,
    });
  });
});

describe('stationTargets', () => {
  it('opens every station of every line with the line as context', () => {
    const stations = lines.flatMap((line) => line.stations);
    const targets = stationTargets('acme', team, lines);
    const [line] = lines;
    const [station] = line?.stations ?? [];

    expect(targets).toHaveLength(stations.length);
    expect(targets[0]).toMatchObject({
      label: station?.name,
      context: line?.name,
      to: `/w/acme/team/${PLATFORM_ID}/lines/${line?.id}/stations/${station?.id}`,
    });
  });
});

describe('taskTargets', () => {
  const completed = new Set(
    lines
      .flatMap((line) => line.stations)
      .filter((station) => station.kind === 'completed')
      .map((station) => station.id),
  );

  it('opens each task that is not in a completed station', () => {
    const open = tasks.filter((task) => !completed.has(task.stationId));

    expect(
      taskTargets('acme', team, tasks, lines).map((each) => each.id),
    ).toEqual(open.map((task) => `task:${task.id}`));
  });

  it('leaves out the tasks in completed stations', () => {
    const done = tasks.filter((task) => completed.has(task.stationId));

    expect(done.length).toBeGreaterThan(0);
    expect(
      taskTargets('acme', team, tasks, lines).map((each) => each.id),
    ).not.toContain(`task:${done[0]?.id}`);
  });
});

describe('settingsTargets', () => {
  it('shows members and API access to admins only', () => {
    const ids = (role: 'admin' | 'member') =>
      settingsTargets('acme', role, teams).map((each) => each.id);

    expect(ids('admin')).toContain('settings:members');
    expect(ids('member')).not.toContain('settings:members');
    expect(ids('member')).not.toContain('settings:api-access');
  });
});

describe('commandKeywords', () => {
  it('matches on the label and the context', () => {
    const target: CommandTarget = {
      id: 'line:review',
      label: 'Review',
      context: 'Backend',
      icon: Package,
      to: '/',
    };

    expect(commandKeywords(target)).toEqual(['Review', 'Backend']);
  });
});

describe('commandMatch', () => {
  it('finds a target when every word appears in its label or context', () => {
    expect(
      commandMatch('', 'memory plat', ['Go to Memory', 'Platform']),
    ).toBeGreaterThan(0);
  });

  it('finds a target whatever the order of the words', () => {
    expect(
      commandMatch('', 'platform memory', ['Go to Memory', 'Platform']),
    ).toBeGreaterThan(0);
    expect(commandMatch('', 'bug login', ['login bug'])).toBeGreaterThan(0);
  });

  it('ignores case', () => {
    expect(commandMatch('', 'MEMORY', ['Go to Memory'])).toBeGreaterThan(0);
  });

  it('skips a target whose letters only appear scattered', () => {
    expect(
      commandMatch('', 'integr', [
        'Referral link in the invite email',
        'Growth',
      ]),
    ).toBe(0);
  });
});

describe('isCommandShortcut', () => {
  const press = (init: KeyboardEventInit) =>
    isCommandShortcut(new KeyboardEvent('keydown', init));

  it('takes K with Command or Ctrl', () => {
    expect(press({ key: 'k', metaKey: true })).toBe(true);
    expect(press({ key: 'K', ctrlKey: true })).toBe(true);
  });

  it('leaves K alone without a modifier, or with Shift or Alt', () => {
    expect(press({ key: 'k' })).toBe(false);
    expect(press({ key: 'k', metaKey: true, shiftKey: true })).toBe(false);
    expect(press({ key: 'k', ctrlKey: true, altKey: true })).toBe(false);
  });
});

describe('commandShortcut', () => {
  it('names the Command key on a Mac and Ctrl elsewhere', () => {
    expect(commandShortcut('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe(
      '⌘K',
    );
    expect(commandShortcut('Mozilla/5.0 (Windows NT 10.0)')).toBe('Ctrl K');
  });
});
