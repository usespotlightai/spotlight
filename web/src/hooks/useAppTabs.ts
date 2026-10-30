import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  APP_TABS_KEY,
  type AppTabs,
  activeTabOf,
  closed,
  newTabPath,
  opened,
  type Place,
  selected,
  storedTabs,
  titled,
  trailOf,
  visited,
} from '@/lib/app-tabs';
import type { ReportTitle } from '@/lib/tab-title';
import type { Team } from '@/lib/team';

const readTabs = (storageKey: string, here: Place): AppTabs => {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {}
  return storedTabs(stored, crypto.randomUUID(), here);
};

const placeOf = (
  pathname: string,
  search: string,
  hash: string,
  state: unknown,
): Place => {
  const trail = trailOf(state);

  return { path: `${pathname}${search}${hash}`, ...(trail && { trail }) };
};

export function useAppTabs(slug: string, teams: readonly Team[]) {
  const { pathname, search, hash, state } = useLocation();
  const navigate = useNavigate();
  const storageKey = `${APP_TABS_KEY}.${slug}`;
  const [shown, setShown] = useState(() => ({
    storageKey,
    tabs: readTabs(storageKey, placeOf(pathname, search, hash, state)),
  }));
  const titles = useRef<{ title: string }[]>([]);

  let tabs = shown.tabs;
  if (shown.storageKey !== storageKey) {
    tabs = readTabs(storageKey, placeOf(pathname, search, hash, state));
    setShown({ storageKey, tabs });
  }

  const change = useCallback(
    (next: (tabs: AppTabs) => AppTabs) =>
      setShown((current) => ({ ...current, tabs: next(current.tabs) })),
    [],
  );

  useEffect(() => {
    try {
      localStorage.setItem(shown.storageKey, JSON.stringify(shown.tabs));
    } catch {}
  }, [shown]);

  useEffect(() => {
    change((current) =>
      visited(current, placeOf(pathname, search, hash, state)),
    );
  }, [change, pathname, search, hash, state]);

  const report = useCallback<ReportTitle>(
    (title) => {
      const entry = { title };
      titles.current = [...titles.current, entry];
      change((current) => titled(current, title));

      return () => {
        titles.current = titles.current.filter((each) => each !== entry);
        const top = titles.current.at(-1);
        if (top) {
          change((current) => titled(current, top.title));
        }
      };
    },
    [change],
  );

  const show = (next: AppTabs) => {
    change(() => next);
    const tab = activeTabOf(next);
    navigate(tab.path, { state: tab.trail ? { trail: tab.trail } : null });
  };

  return {
    tabs: tabs.tabs,
    activeId: tabs.activeId,
    report,
    select: (id: string) => {
      if (id !== tabs.activeId) {
        show(selected(tabs, id));
      }
    },
    close: (id: string) => {
      const next = closed(tabs, id);
      if (next.activeId === tabs.activeId) {
        change(() => next);
      } else {
        show(next);
      }
    },
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
