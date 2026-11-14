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
import type { ReportTitle } from '@/lib/tab-title';
import type { Team } from '@/lib/team';

const readTabs = (storageKey: string, here: Place): AppTabs => {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {}
  return visited(storedTabs(stored, crypto.randomUUID(), here), here);
};

type Change = (next: (tabs: AppTabs) => AppTabs) => void;

function useTitleReports(change: Change) {
  const reports = useRef(new Map<string, ReportTitle>());

  return useCallback(
    (id: string): ReportTitle => {
      const known = reports.current.get(id);
      if (known) {
        return known;
      }

      let titles: { title: string }[] = [];
      const report: ReportTitle = (title) => {
        const entry = { title };
        titles = [...titles, entry];
        change((current) => titled(current, title, id));

        return () => {
          titles = titles.filter((each) => each !== entry);
          const top = titles.at(-1);
          if (top) {
            change((current) => titled(current, top.title, id));
          }
        };
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
  const here = placeOf(pathname, search, hash, state);
  const [shown, setShown] = useState(() => ({
    storageKey,
    path: here.path,
    state,
    tabs: readTabs(storageKey, here),
  }));

  let tabs = shown.tabs;
  if (shown.storageKey !== storageKey) {
    tabs = readTabs(storageKey, here);
    setShown({ storageKey, path: here.path, state, tabs });
  } else if (shown.path !== here.path || shown.state !== state) {
    tabs = visited(tabs, here);
    setShown({ ...shown, path: here.path, state, tabs });
  }

  const change = useCallback<Change>(
    (next) => setShown((current) => ({ ...current, tabs: next(current.tabs) })),
    [],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        shown.storageKey,
        JSON.stringify(storableTabs(shown.tabs)),
      );
    } catch {}
  }, [shown]);

  const titleFor = useTitleReports(change);
  const visit = useCallback(
    (id: string, place: Place) =>
      change((current) => visited(current, place, id)),
    [change],
  );

  const show = (next: AppTabs, replace = false) => {
    change(() => next);
    const tab = activeTabOf(next);
    void navigate(tab.path, {
      replace,
      state: tab.state ?? null,
    });
  };

  const apply = (next: AppTabs) => {
    if (next.activeId === tabs.activeId) {
      change(() => next);
    } else {
      show(next);
    }
  };

  return {
    tabs: tabs.tabs,
    activeId: tabs.activeId,
    splitId: tabs.splitId,
    panes: panesOf(tabs),
    titleFor,
    visit,
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
      change((current) => moved(current, id, to)),
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
