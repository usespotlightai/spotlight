import { useCallback, useEffect, useRef, useState } from 'react';
import { type Location, useLocation, useNavigate } from 'react-router';

import {
  APP_TABS_KEY,
  type AppTabs,
  activeTabOf,
  back,
  closed,
  forward,
  moved,
  newTabPath,
  focused,
  opened,
  panesOf,
  type Place,
  placeAt,
  placed,
  type SplitSide,
  selected,
  storableTabs,
  storedTabs,
  titled,
  visited,
  withoutPane,
} from '@/lib/app-tabs';
import {
  described,
  forgotten,
  RECENT_PAGES_KEY,
  type RecentPage,
  recorded,
  storedPages,
} from '@/lib/recent-pages';
import type { TabReports } from '@/lib/tab-title';
import type { Team } from '@/lib/team';

const readTabs = (storageKey: string, here: Place): AppTabs => {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {}
  return visited(storedTabs(stored, crypto.randomUUID(), here), here);
};

const readRecent = (storageKey: string, here: Place): readonly RecentPage[] => {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {}
  return recorded(storedPages(stored), here.path);
};

type Shown = {
  readonly storageKey: string;
  readonly recentKey: string;
  readonly path: string;
  readonly state: unknown;
  readonly tabs: AppTabs;
  readonly recent: readonly RecentPage[];
};

type Change = (next: (shown: Shown) => Shown) => void;

const withTabs =
  (next: (tabs: AppTabs) => AppTabs) =>
  (shown: Shown): Shown => ({ ...shown, tabs: next(shown.tabs) });

const pathOf = (shown: Shown, id: string): string | undefined =>
  shown.tabs.tabs.find((tab) => tab.id === id)?.path;

const withDetails =
  (id: string, details: { title?: string; label?: string }) =>
  (shown: Shown): Shown => {
    const path = pathOf(shown, id);

    return path
      ? { ...shown, recent: described(shown.recent, path, details) }
      : shown;
  };

function useTabReports(change: Change) {
  const reports = useRef(new Map<string, TabReports>());

  return useCallback(
    (id: string): TabReports => {
      const known = reports.current.get(id);
      if (known) {
        return known;
      }

      let titles: { title: string }[] = [];
      const report: TabReports = {
        title: (title) => {
          const entry = { title };
          titles = [...titles, entry];
          change(withTabs((current) => titled(current, title, id)));
          change(withDetails(id, { title }));

          return () => {
            titles = titles.filter((each) => each !== entry);
            const top = titles.at(-1);
            if (top) {
              change(withTabs((current) => titled(current, top.title, id)));
            }
          };
        },
        label: (label) => change(withDetails(id, { label })),
        missing: () =>
          change((shown) => {
            const path = pathOf(shown, id);

            return path
              ? { ...shown, recent: forgotten(shown.recent, path) }
              : shown;
          }),
      };
      reports.current.set(id, report);

      return report;
    },
    [change],
  );
}

const placeOf = (
  pathname: string,
  search: string,
  hash: string,
  state: unknown,
): Place => placeAt(`${pathname}${search}${hash}`, state);

export function useAppTabs(slug: string, teams: readonly Team[]) {
  const location: Location<unknown> = useLocation();
  const { pathname, search, hash, state } = location;
  const navigate = useNavigate();
  const storageKey = `${APP_TABS_KEY}.${slug}`;
  const recentKey = `${RECENT_PAGES_KEY}.${slug}`;
  const here = placeOf(pathname, search, hash, state);
  const [shown, setShown] = useState<Shown>(() => ({
    storageKey,
    recentKey,
    path: here.path,
    state,
    tabs: readTabs(storageKey, here),
    recent: readRecent(recentKey, here),
  }));

  let tabs = shown.tabs;
  if (shown.storageKey !== storageKey) {
    tabs = readTabs(storageKey, here);
    setShown({
      storageKey,
      recentKey,
      path: here.path,
      state,
      tabs,
      recent: readRecent(recentKey, here),
    });
  } else if (shown.path !== here.path || shown.state !== state) {
    tabs = visited(tabs, here);
    setShown({
      ...shown,
      path: here.path,
      state,
      tabs,
      recent: recorded(shown.recent, here.path),
    });
  }

  const change = useCallback<Change>(
    (next) => setShown((current) => next(current)),
    [],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        shown.storageKey,
        JSON.stringify(storableTabs(shown.tabs)),
      );
    } catch {}
  }, [shown.storageKey, shown.tabs]);

  useEffect(() => {
    try {
      localStorage.setItem(shown.recentKey, JSON.stringify(shown.recent));
    } catch {}
  }, [shown.recentKey, shown.recent]);

  const reportsFor = useTabReports(change);
  const visit = useCallback(
    (id: string, place: Place) =>
      change((current) => ({
        ...current,
        tabs: visited(current.tabs, place, id),
        recent: recorded(current.recent, place.path),
      })),
    [change],
  );

  const show = (next: AppTabs, replace = false) => {
    change(withTabs(() => next));
    const tab = activeTabOf(next);
    void navigate(tab.path, {
      replace,
      state: tab.state ?? null,
    });
  };

  const apply = (next: AppTabs) => {
    if (next.activeId === tabs.activeId) {
      change(withTabs(() => next));
    } else {
      show(next);
    }
  };

  return {
    tabs: tabs.tabs,
    activeId: tabs.activeId,
    splitId: tabs.splitId,
    panes: panesOf(tabs),
    reportsFor,
    visit,
    recent: shown.recent,
    showRecent: (path: string) => void navigate(path),
    focus: (id: string) => {
      if (id === tabs.splitId) {
        show(focused(tabs, id), true);
      }
    },
    select: (id: string) => apply(selected(tabs, id)),
    close: (id: string) => apply(closed(tabs, id)),
    canPlace: (id: string, side: SplitSide) => placed(tabs, id, side) !== tabs,
    place: (id: string, side: SplitSide) => apply(placed(tabs, id, side)),
    hidePane: (side: SplitSide) => apply(withoutPane(tabs, side)),
    move: (id: string, to: string) =>
      change(withTabs((current) => moved(current, id, to))),
    canGoBack: activeTabOf(tabs).back.length > 0,
    canGoForward: activeTabOf(tabs).forward.length > 0,
    back: () => show(back(tabs), true),
    forward: () => show(forward(tabs), true),
    open: () =>
      show(
        opened(
          tabs,
          crypto.randomUUID(),
          newTabPath(slug, teams, activeTabOf(tabs).path),
        ),
      ),
  };
}
