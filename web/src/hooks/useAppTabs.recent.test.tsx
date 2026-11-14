import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAppTabs } from '@/hooks/useAppTabs';
import { RECENT_PAGES_KEY } from '@/lib/recent-pages';

const TEAMS = [{ id: 'team_1', name: 'Platform' }];

const wrapperAt =
  (path: string) =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  );

const setup = (path = '/w/acme/inbox') =>
  renderHook(
    () => ({ tabs: useAppTabs('acme', TEAMS), location: useLocation() }),
    { wrapper: wrapperAt(path) },
  );

const pathsOf = (result: ReturnType<typeof setup>['result']) =>
  result.current.tabs.recent.map((page) => page.path);

beforeEach(() => {
  localStorage.clear();
});

describe('useAppTabs recent pages', () => {
  it('starts with the page that is shown', () => {
    const { result } = setup();

    expect(pathsOf(result)).toEqual(['/w/acme/inbox']);
  });

  it('records a visit in a tab that is not the active one', () => {
    const { result } = setup();
    const first = result.current.tabs.activeId;

    act(() => result.current.tabs.open());
    act(() =>
      result.current.tabs.visit(first, { path: '/w/acme/team/team_1/runs' }),
    );

    expect(pathsOf(result)).toEqual([
      '/w/acme/team/team_1/runs',
      '/w/acme/team/team_1/agent',
      '/w/acme/inbox',
    ]);
  });

  it('moves a page that is visited again to the top', () => {
    const { result } = setup();
    const first = result.current.tabs.activeId;

    act(() => result.current.tabs.visit(first, { path: '/w/acme/a' }));
    act(() => result.current.tabs.visit(first, { path: '/w/acme/b' }));
    act(() => result.current.tabs.visit(first, { path: '/w/acme/a' }));

    expect(pathsOf(result)).toEqual([
      '/w/acme/a',
      '/w/acme/b',
      '/w/acme/inbox',
    ]);
  });

  it('keeps the last 15 pages', () => {
    const { result } = setup();
    const first = result.current.tabs.activeId;

    for (let at = 0; at < 20; at += 1) {
      act(() => result.current.tabs.visit(first, { path: `/w/acme/p${at}` }));
    }

    expect(result.current.tabs.recent).toHaveLength(15);
    expect(pathsOf(result)[0]).toBe('/w/acme/p19');
  });

  it('gives a page the title and label that its tab reports', () => {
    const { result } = setup('/w/acme/team/team_1/tasks/task_1');
    const id = result.current.tabs.activeId;

    act(() => {
      const reports = result.current.tabs.reportsFor(id);
      reports.title('Fix the queue');
      reports.label('SPO-272');
    });

    expect(result.current.tabs.recent[0]).toEqual({
      path: '/w/acme/team/team_1/tasks/task_1',
      title: 'Fix the queue',
      label: 'SPO-272',
    });
  });

  it('forgets the page that its tab reports as missing', () => {
    const { result } = setup('/w/acme/team/team_1/tasks/task_1');
    const id = result.current.tabs.activeId;

    act(() => result.current.tabs.reportsFor(id).missing());

    expect(pathsOf(result)).toEqual([]);
  });

  it('shows a chosen page in the active tab', () => {
    const { result } = setup();

    act(() => result.current.tabs.showRecent('/w/acme/team/team_1/runs'));

    expect(result.current.location.pathname).toBe('/w/acme/team/team_1/runs');
    expect(pathsOf(result)[0]).toBe('/w/acme/team/team_1/runs');
  });

  it('saves the pages for the workspace and gives them back next time', () => {
    const first = setup();
    const id = first.result.current.tabs.activeId;

    act(() => first.result.current.tabs.visit(id, { path: '/w/acme/a' }));
    first.unmount();

    expect(
      JSON.parse(localStorage.getItem(`${RECENT_PAGES_KEY}.acme`) ?? 'null'),
    ).toEqual([
      { path: '/w/acme/a', title: null },
      { path: '/w/acme/inbox', title: null },
    ]);

    const second = setup('/w/acme/settings/general');

    expect(pathsOf(second.result)).toEqual([
      '/w/acme/settings/general',
      '/w/acme/a',
      '/w/acme/inbox',
    ]);
  });

  it('starts again where the saved pages are not readable', () => {
    localStorage.setItem(`${RECENT_PAGES_KEY}.acme`, '{oops');

    const { result } = setup();

    expect(pathsOf(result)).toEqual(['/w/acme/inbox']);
  });
});
