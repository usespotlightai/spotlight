import { Inbox, MousePointer2, Package, Settings2 } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import {
  type AppTabs,
  TAB_HISTORY_LIMIT,
  back,
  closed,
  forward,
  moved,
  newTabPath,
  focused,
  opened,
  panesOf,
  placeAt,
  placed,
  selected,
  storableTabs,
  storedTabs,
  tabIconOf,
  titled,
  visited,
  withoutPane,
} from '@/lib/app-tabs';

const TEAMS = [
  { id: 'team_1', name: 'Platform' },
  { id: 'team_2', name: 'Growth' },
];

const inbox = {
  id: 'a',
  path: '/w/acme/inbox',
  title: 'Inbox',
  back: [],
  forward: [],
};

const three: AppTabs = {
  tabs: [
    inbox,
    {
      id: 'b',
      path: '/w/acme/team/team_1/runs',
      title: 'Runs',
      back: [],
      forward: [],
    },
    {
      id: 'c',
      path: '/w/acme/team/team_1/memory',
      title: 'Memory',
      back: [],
      forward: [],
    },
  ],
  activeId: 'b',
};

describe('moved', () => {
  const order = (tabs: AppTabs) => tabs.tabs.map((tab) => tab.id);

  it('moves a tab to the right, to where the other tab was', () => {
    expect(order(moved(three, 'a', 'c'))).toEqual(['b', 'c', 'a']);
  });

  it('moves a tab to the left, to where the other tab was', () => {
    expect(order(moved(three, 'c', 'a'))).toEqual(['c', 'a', 'b']);
  });

  it('keeps the active tab', () => {
    expect(moved(three, 'b', 'a').activeId).toBe('b');
  });

  it('changes nothing for a tab it does not know or a drop on the same tab', () => {
    expect(moved(three, 'x', 'a')).toBe(three);
    expect(moved(three, 'a', 'a')).toBe(three);
  });
});

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
      back: [{ path: '/w/acme/team/team_1/runs' }],
      forward: [],
    });
    expect(next.tabs[0]).toBe(three.tabs[0]);
  });

  it('keep what the page was opened with', () => {
    const state = { prompt: 'Set up our configuration as code.' };
    const place = placeAt('/w/acme/team/team_1/agent', state);

    expect(visited(three, place).tabs[1]?.state).toBe(state);
    expect(placeAt('/w/acme/inbox', null)).toEqual({ path: '/w/acme/inbox' });
  });
});

describe('tab history', () => {
  const runs = three.tabs[1];
  const insights = { path: '/w/acme/team/team_1/insights' };
  const agent = { path: '/w/acme/team/team_1/agent' };
  const tabB = (tabs: AppTabs) => tabs.tabs[1];

  it('pushes the page left behind and drops the forward entries', () => {
    const stepped = back(visited(visited(three, insights), agent));
    const next = visited(stepped, { path: '/w/acme/settings' });

    expect(tabB(next)?.back).toEqual([{ path: runs.path }, insights]);
    expect(tabB(next)?.forward).toEqual([]);
  });

  it('keeps the history when the same page is shown again', () => {
    const state = { trail: [{ label: 'Runs' }] };
    const next = visited(three, placeAt(runs.path, state));

    expect(tabB(next)?.back).toEqual([]);
    expect(tabB(next)?.state).toBe(state);
  });

  it('goes back and forward through the pages of the tab', () => {
    const there = visited(visited(three, insights), agent);
    const earlier = back(back(there));

    expect(tabB(earlier)?.path).toBe(runs.path);
    expect(tabB(earlier)?.forward).toEqual([insights, agent]);
    expect(tabB(forward(forward(earlier)))).toEqual(tabB(there));
  });

  it('stays the same object with nothing to go back or forward to', () => {
    expect(back(three)).toBe(three);
    expect(forward(three)).toBe(three);
  });

  it('drops the oldest entry above the limit', () => {
    let tabs = three;
    for (let at = 0; at <= TAB_HISTORY_LIMIT; at += 1) {
      tabs = visited(tabs, { path: `/w/acme/page-${at}` });
    }

    expect(tabB(tabs)?.back).toHaveLength(TAB_HISTORY_LIMIT);
    expect(tabB(tabs)?.back[0]?.path).toBe('/w/acme/page-0');
  });

  it('moves only the tab with the given id', () => {
    const split: AppTabs = { ...three, activeId: 'a', splitId: 'b' };
    const there = visited(split, insights, 'b');
    const earlier = back(there, 'b');

    expect(tabB(earlier)?.path).toBe(runs.path);
    expect(earlier.tabs[0]).toBe(three.tabs[0]);
    expect(back(there)).toBe(there);
  });

  it('goes with the tab when it is closed', () => {
    const there = visited(three, insights);
    const next = closed(there, 'b');

    expect(next.tabs.map((tab) => tab.id)).toEqual(['a', 'c']);
    expect(JSON.stringify(next)).not.toContain(runs.path);
  });

  it('is stored and loaded again with its trails', () => {
    const trail = [{ label: 'Platform', to: '/w/acme/team/team_1' }];
    const there = visited(
      visited(three, placeAt(insights.path, { trail, prompt: 'x' })),
      agent,
    );
    const stored = JSON.stringify(storableTabs(back(there)));
    const loaded = storedTabs(stored, 'new', { path: '/w/acme/other' });

    expect(tabB(loaded)?.back).toEqual([{ path: runs.path }]);
    expect(tabB(loaded)?.forward).toEqual([agent]);
    expect(tabB(loaded)?.path).toBe(insights.path);
    expect(tabB(loaded)?.state).toEqual({ trail });
  });

  it('loads saved tabs that have no history', () => {
    const stored = JSON.stringify({
      tabs: [{ id: 'a', path: '/w/acme/inbox', title: 'Inbox' }],
      activeId: 'a',
    });
    const [tab] = storedTabs(stored, 'new', { path: '/w/acme/inbox' }).tabs;

    expect(tab?.back).toEqual([]);
    expect(tab?.forward).toEqual([]);
  });

  it('drops history entries that are malformed', () => {
    const stored = JSON.stringify({
      tabs: [
        {
          id: 'a',
          path: '/w/acme/inbox',
          back: [{ path: '/w/acme/ok' }, { path: 3 }, null, 'x'],
          forward: 'nope',
        },
      ],
      activeId: 'a',
    });
    const [tab] = storedTabs(stored, 'new', { path: '/w/acme/inbox' }).tabs;

    expect(tab?.back).toEqual([{ path: '/w/acme/ok' }]);
    expect(tab?.forward).toEqual([]);
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
      back: [],
      forward: [],
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
      tabs: [
        { id: 'new', path: here.path, title: null, back: [], forward: [] },
      ],
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
        { id: 'a', path: '/w/acme/inbox', title: 'Inbox', state: { trail } },
        {
          id: 'b',
          path: '/w/acme/settings',
          title: null,
          state: { trail: [{}] },
        },
      ],
      activeId: 'a',
    });

    const [first, second] = storedTabs(stored, 'new', here).tabs;

    expect(first?.state).toEqual({ trail });
    expect(second).toEqual({
      id: 'b',
      path: '/w/acme/settings',
      title: null,
      back: [],
      forward: [],
    });
  });
});

describe('storableTabs', () => {
  it('keeps only the trail of what each tab was opened with', () => {
    const trail = [{ label: 'Platform', to: '/w/acme/team/team_1' }];
    const tabs: AppTabs = {
      ...three,
      tabs: [
        { ...inbox, state: { trail, prompt: 'Set up.' } },
        { ...three.tabs[1], state: { prompt: 'Set up.' } },
        three.tabs[2],
      ],
    };

    expect(storableTabs(tabs).tabs).toEqual([
      { ...inbox, state: { trail } },
      three.tabs[1],
      three.tabs[2],
    ]);
  });
});

describe('placed', () => {
  const split: AppTabs = {
    ...three,
    activeId: 'a',
    splitId: 'b',
    splitSide: 'right',
  };

  it('shows a dropped tab on that side and focuses it', () => {
    expect(placed(three, 'c', 'right')).toEqual({
      tabs: three.tabs,
      activeId: 'c',
      splitId: 'b',
      splitSide: 'left',
    });
    expect(panesOf(placed(three, 'c', 'left'))).toEqual({
      left: 'c',
      right: 'b',
    });
  });

  it('moves the active tab to the right and shows its neighbour on the left', () => {
    expect(panesOf(placed(three, 'b', 'right'))).toEqual({
      left: 'c',
      right: 'b',
    });
  });

  it('swaps the two sides', () => {
    expect(panesOf(placed(split, 'b', 'left'))).toEqual({
      left: 'b',
      right: 'a',
    });
    expect(panesOf(placed(split, 'a', 'right'))).toEqual({
      left: 'b',
      right: 'a',
    });
  });

  it('replaces the tab on the side it is dropped on', () => {
    expect(panesOf(placed(split, 'c', 'right'))).toEqual({
      left: 'a',
      right: 'c',
    });
    expect(panesOf(placed(split, 'c', 'left'))).toEqual({
      left: 'c',
      right: 'b',
    });
  });

  it('changes nothing for a tab already on that side, the only tab, or a tab it does not know', () => {
    expect(placed(split, 'a', 'left')).toBe(split);
    expect(placed(split, 'b', 'right')).toBe(split);
    expect(placed(three, 'b', 'left')).toBe(three);
    expect(placed(three, 'x', 'right')).toBe(three);

    const one: AppTabs = { tabs: [inbox], activeId: 'a' };
    expect(placed(one, 'a', 'right')).toBe(one);
  });
});

describe('split view', () => {
  const split: AppTabs = {
    ...three,
    activeId: 'a',
    splitId: 'b',
    splitSide: 'right',
  };

  it('focuses the other pane and keeps both panes where they are', () => {
    const next = focused(split, 'b');

    expect(next).toMatchObject({ activeId: 'b', splitId: 'a' });
    expect(panesOf(next)).toEqual(panesOf(split));
    expect(focused(split, 'c')).toBe(split);
  });

  it('opens a selected tab in the focused pane, or focuses the other pane', () => {
    expect(panesOf(selected(split, 'c'))).toEqual({ left: 'c', right: 'b' });
    expect(panesOf(selected(focused(split, 'b'), 'c'))).toEqual({
      left: 'a',
      right: 'c',
    });
    expect(selected(split, 'b')).toEqual(focused(split, 'b'));
  });

  it('gives the whole view to the other pane when the focused tab closes', () => {
    expect(closed(split, 'a')).toEqual({
      tabs: [three.tabs[1], three.tabs[2]],
      activeId: 'b',
    });
  });

  it('ends the split view when the other tab closes', () => {
    expect(closed(split, 'b')).toEqual({
      tabs: [three.tabs[0], three.tabs[2]],
      activeId: 'a',
    });
  });

  it('keeps the split view when another tab closes or opens', () => {
    expect(closed(split, 'c')).toMatchObject({ activeId: 'a', splitId: 'b' });
    expect(panesOf(opened(split, 'd', '/w/acme/inbox'))).toEqual({
      left: 'd',
      right: 'b',
    });
  });

  it('changes the tab it is asked to', () => {
    const place = { path: '/w/acme/team/team_1/runs/run_1' };

    expect(visited(split, place, 'b').tabs[1]?.path).toBe(place.path);
    expect(titled(split, 'Run', 'b').tabs[1]?.title).toBe('Run');
  });

  it('restores the split view and focuses the pane at the address', () => {
    const stored = JSON.stringify(split);

    expect(storedTabs(stored, 'new', { path: '/w/acme/inbox' })).toEqual(split);
    expect(
      storedTabs(stored, 'new', { path: '/w/acme/team/team_1/runs' }),
    ).toEqual(focused(split, 'b'));
  });
});

describe('withoutPane', () => {
  const split: AppTabs = {
    ...three,
    activeId: 'a',
    splitId: 'b',
    splitSide: 'right',
  };

  it('gives the whole view to the other pane and keeps both tabs', () => {
    expect(withoutPane(split, 'right')).toEqual({
      tabs: three.tabs,
      activeId: 'a',
    });
    expect(withoutPane(split, 'left')).toEqual({
      tabs: three.tabs,
      activeId: 'b',
    });
  });

  it('changes nothing without a split view', () => {
    expect(withoutPane(three, 'left')).toBe(three);
  });
});
