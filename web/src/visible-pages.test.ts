import { describe, expect, it } from 'vitest';

import { APP_TABS_KEY } from '@/lib/app-tabs';

import { pagesAt, visiblePaths } from './visible-pages';

const tab = (id: string, path: string) => ({
  id,
  path,
  title: null,
  back: [],
  forward: [],
});

describe('visiblePaths', () => {
  it('shows the page at the address when no tabs are stored', () => {
    expect(visiblePaths('/w/acme/inbox', () => null)).toEqual([
      '/w/acme/inbox',
    ]);
  });

  it('also shows the other pane of a split view', () => {
    const stored = JSON.stringify({
      tabs: [
        tab('a', '/w/acme/inbox/item_1'),
        tab('b', '/w/acme/team/team_1/runs?state=failed'),
      ],
      activeId: 'a',
      splitId: 'b',
    });
    const keys: string[] = [];

    expect(
      visiblePaths('/w/acme/inbox/item_1', (slug) => {
        keys.push(`${APP_TABS_KEY}.${slug}`);
        return stored;
      }),
    ).toEqual(['/w/acme/inbox/item_1', '/w/acme/team/team_1/runs']);
    expect(keys).toEqual([`${APP_TABS_KEY}.acme`]);
  });

  it('keeps a path outside a workspace as it is', () => {
    expect(visiblePaths('/login', () => null)).toEqual(['/login']);
  });
});

describe('pagesAt', () => {
  it('finds the lazy page of a workspace path', () => {
    const pages = pagesAt(['/w/acme/inbox/item_1']);

    expect(pages).toHaveLength(1);
    expect(typeof pages[0].preload).toBe('function');
  });

  it('finds no page for a path with no route', () => {
    expect(pagesAt(['/nowhere'])).toEqual([]);
  });
});
