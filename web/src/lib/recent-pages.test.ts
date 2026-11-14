import { ListTodo, Package, Play, Settings2 } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import {
  described,
  forgotten,
  kindOf,
  RECENT_PAGES_LIMIT,
  type RecentPage,
  recorded,
  storedPages,
} from '@/lib/recent-pages';

const page = (path: string, title: string | null = null): RecentPage => ({
  path,
  title,
});

const pathsOf = (pages: readonly RecentPage[]) =>
  pages.map((each) => each.path);

const many = (count: number): readonly RecentPage[] =>
  Array.from({ length: count }, (_, at) => page(`/w/acme/page-${at}`));

describe('recorded', () => {
  it('puts the newest page first', () => {
    const pages = recorded([page('/a')], '/b');

    expect(pathsOf(pages)).toEqual(['/b', '/a']);
  });

  it('moves a page that is seen again to the top, once', () => {
    const pages = recorded([page('/b'), page('/a')], '/a');

    expect(pathsOf(pages)).toEqual(['/a', '/b']);
  });

  it('keeps what it knows of a page that is seen again', () => {
    const pages = recorded([page('/b'), page('/a', 'Alpha')], '/a');

    expect(pages[0]).toEqual(page('/a', 'Alpha'));
  });

  it('keeps the last 15 pages', () => {
    const pages = recorded(many(RECENT_PAGES_LIMIT), '/w/acme/new');

    expect(pages).toHaveLength(RECENT_PAGES_LIMIT);
    expect(pages[0]?.path).toBe('/w/acme/new');
    expect(pathsOf(pages)).not.toContain(
      `/w/acme/page-${RECENT_PAGES_LIMIT - 1}`,
    );
  });

  it('tells pages apart by their query', () => {
    const pages = recorded([page('/a?x=1')], '/a?x=2');

    expect(pathsOf(pages)).toEqual(['/a?x=2', '/a?x=1']);
  });

  it('ignores the hash', () => {
    const pages = recorded([page('/a')], '/a#top');

    expect(pathsOf(pages)).toEqual(['/a']);
  });
});

describe('described', () => {
  it('gives a page its title and label', () => {
    const pages = described([page('/a')], '/a', {
      title: 'Alpha',
      label: 'SPO-272',
    });

    expect(pages).toEqual([{ path: '/a', title: 'Alpha', label: 'SPO-272' }]);
  });

  it('leaves the other pages and their order alone', () => {
    const pages = described([page('/b'), page('/a')], '/a', { title: 'Alpha' });

    expect(pages).toEqual([page('/b'), page('/a', 'Alpha')]);
  });

  it('adds no page that it does not know', () => {
    expect(described([page('/a')], '/b', { title: 'Beta' })).toEqual([
      page('/a'),
    ]);
  });
});

describe('forgotten', () => {
  it('removes one page', () => {
    expect(pathsOf(forgotten([page('/b'), page('/a')], '/b'))).toEqual(['/a']);
  });

  it('changes nothing for a page that is not there', () => {
    expect(pathsOf(forgotten([page('/a')], '/z'))).toEqual(['/a']);
  });
});

describe('storedPages', () => {
  it('loads what was saved, in order', () => {
    const saved = [
      page('/b', 'Beta'),
      { path: '/a', title: null, label: 'X-1' },
    ];

    expect(storedPages(JSON.stringify(saved))).toEqual(saved);
  });

  it('gives no pages where nothing was saved', () => {
    expect(storedPages(null)).toEqual([]);
  });

  it('gives no pages for text that is not JSON', () => {
    expect(storedPages('{oops')).toEqual([]);
  });

  it('gives no pages for JSON that is not a list', () => {
    expect(storedPages('{"path":"/a"}')).toEqual([]);
  });

  it('drops the entries that have no path', () => {
    const stored = JSON.stringify([
      null,
      'text',
      { title: 'No path' },
      { path: 3 },
      { path: '' },
      { path: '/a', title: 7, label: 9 },
    ]);

    expect(storedPages(stored)).toEqual([page('/a')]);
  });

  it('keeps only the first 15 entries', () => {
    expect(storedPages(JSON.stringify(many(RECENT_PAGES_LIMIT + 5)))).toEqual(
      many(RECENT_PAGES_LIMIT),
    );
  });
});

describe('kindOf', () => {
  it('names a task page', () => {
    expect(kindOf('/w/acme/team/t1/tasks/k1')).toEqual({
      label: 'Task',
      icon: ListTodo,
    });
  });

  it('names a run page from the team and from the inbox', () => {
    expect(kindOf('/w/acme/team/t1/runs/r1?tab=net').label).toBe('Run');
    expect(kindOf('/w/acme/inbox/teams/t1/runs/r1')).toEqual({
      label: 'Run',
      icon: Play,
    });
  });

  it('names a line, a chat, a team section, the inbox and the settings', () => {
    expect(kindOf('/w/acme/team/t1/lines/l1').label).toBe('Line');
    expect(kindOf('/w/acme/team/t1/agent/c1').label).toBe('Chat');
    expect(kindOf('/w/acme/team/t1/memory').label).toBe('Team');
    expect(kindOf('/w/acme/inbox').label).toBe('Inbox');
    expect(kindOf('/w/acme/settings/members')).toEqual({
      label: 'Settings',
      icon: Settings2,
    });
  });

  it('calls any other page a page', () => {
    expect(kindOf('/w/acme')).toEqual({ label: 'Page', icon: Package });
  });
});
