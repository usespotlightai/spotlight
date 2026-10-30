import { Inbox, MousePointer2, Package, Settings2 } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import {
  type AppTabs,
  closed,
  newTabPath,
  opened,
  storedTabs,
  tabIconOf,
  titled,
  visited,
} from '@/lib/app-tabs';

const TEAMS = [
  { id: 'team_1', name: 'Platform' },
  { id: 'team_2', name: 'Growth' },
];

const inbox = { id: 'a', path: '/w/acme/inbox', title: 'Inbox' };

const three: AppTabs = {
  tabs: [
    inbox,
    { id: 'b', path: '/w/acme/team/team_1/runs', title: 'Runs' },
    { id: 'c', path: '/w/acme/team/team_1/memory', title: 'Memory' },
  ],
  activeId: 'b',
};

describe('closed', () => {
  it('shows the tab to the right of the closed active tab', () => {
    expect(closed(three, 'b').activeId).toBe('c');
  });

  it('shows the tab to the left when the last tab closes', () => {
    expect(closed({ ...three, activeId: 'c' }, 'c').activeId).toBe('b');
  });

  it('keeps the active tab when another tab closes', () => {
    const next = closed(three, 'a');

    expect(next.activeId).toBe('b');
    expect(next.tabs.map((tab) => tab.id)).toEqual(['b', 'c']);
  });

  it('keeps the only tab open', () => {
    const one: AppTabs = { tabs: [inbox], activeId: 'a' };

    expect(closed(one, 'a')).toBe(one);
  });
});

describe('visited and titled', () => {
  it('change only the active tab', () => {
    const next = titled(
      visited(three, { path: '/w/acme/team/team_1/insights' }),
      'Insights',
    );

    expect(next.tabs[1]).toEqual({
      id: 'b',
      path: '/w/acme/team/team_1/insights',
      title: 'Insights',
    });
    expect(next.tabs[0]).toBe(three.tabs[0]);
  });
});

describe('opened', () => {
  it('adds an untitled tab at the end and shows it', () => {
    const next = opened(three, 'd', '/w/acme/team/team_1/agent');

    expect(next.activeId).toBe('d');
    expect(next.tabs.at(-1)).toEqual({
      id: 'd',
      path: '/w/acme/team/team_1/agent',
      title: null,
    });
  });
});

describe('newTabPath', () => {
  it('opens the agent of the team on the page', () => {
    expect(newTabPath('acme', TEAMS, '/w/acme/team/team_2/runs/run_1')).toBe(
      '/w/acme/team/team_2/agent',
    );
  });

  it('opens the agent of the team in team settings', () => {
    expect(
      newTabPath('acme', TEAMS, '/w/acme/settings/team/team_2/skills'),
    ).toBe('/w/acme/team/team_2/agent');
  });

  it('opens the agent of the first team outside a team', () => {
    expect(newTabPath('acme', TEAMS, '/w/acme/inbox')).toBe(
      '/w/acme/team/team_1/agent',
    );
  });

  it('opens the inbox in a workspace without teams', () => {
    expect(newTabPath('acme', [], '/w/acme/settings/general')).toBe(
      '/w/acme/inbox',
    );
  });
});

describe('tabIconOf', () => {
  it('follows the area of the page', () => {
    expect(tabIconOf('/w/acme/inbox/item_1')).toBe(Inbox);
    expect(tabIconOf('/w/acme/team/team_1/agent/chat_1')).toBe(MousePointer2);
    expect(tabIconOf('/w/acme/settings/runners')).toBe(Settings2);
    expect(tabIconOf('/w/acme/team/team_1/lines/line_1')).toBe(Package);
  });
});

describe('storedTabs', () => {
  const here = { path: '/w/acme/team/team_1/memory' };

  it('starts with one tab at the address when nothing is stored', () => {
    expect(storedTabs(null, 'new', here)).toEqual({
      tabs: [{ id: 'new', path: here.path, title: null }],
      activeId: 'new',
    });
  });

  it('starts with one tab when the stored tabs do not parse', () => {
    expect(storedTabs('{not json', 'new', here).tabs).toHaveLength(1);
    expect(storedTabs('{"tabs":[{"id":1}]}', 'new', here).activeId).toBe('new');
  });

  it('shows the stored tab that has the address open', () => {
    expect(storedTabs(JSON.stringify(three), 'new', here).activeId).toBe('c');
  });

  it('shows the stored active tab for another address', () => {
    expect(
      storedTabs(JSON.stringify(three), 'new', { path: '/w/acme/settings' })
        .activeId,
    ).toBe('b');
  });

  it('keeps a stored trail and leaves out a broken one', () => {
    const trail = [{ label: 'Platform', to: '/w/acme/team/team_1' }];
    const stored = JSON.stringify({
      tabs: [
        { id: 'a', path: '/w/acme/inbox', title: 'Inbox', trail },
        { id: 'b', path: '/w/acme/settings', title: null, trail: [{}] },
      ],
      activeId: 'a',
    });

    const [first, second] = storedTabs(stored, 'new', here).tabs;

    expect(first?.trail).toEqual(trail);
    expect(second).toEqual({ id: 'b', path: '/w/acme/settings', title: null });
  });
});
