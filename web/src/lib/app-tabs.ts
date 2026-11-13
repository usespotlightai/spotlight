import {
  ChartNoAxesColumn,
  Inbox,
  type LucideIcon,
  MousePointer2,
  Package,
  Play,
  Settings2,
  Spool,
} from 'lucide-react';
import { matchPath } from 'react-router';

import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { inboxPath } from '@/lib/inbox';
import { type Team, teamSectionPath } from '@/lib/team';

export const APP_TABS_KEY = 'spotlight.tabs';

export const NEW_TAB_TITLE = 'New tab';

export type AppTab = {
  readonly id: string;
  readonly path: string;
  readonly title: string | null;
  readonly trail?: readonly BreadcrumbSegment[];
};

export type AppTabs = {
  readonly tabs: readonly AppTab[];
  readonly activeId: string;
  readonly splitId?: string;
  readonly splitSide?: SplitSide;
};

export type SplitSide = 'left' | 'right';

export type Panes = {
  readonly left: string;
  readonly right?: string;
};

export type Place = {
  readonly path: string;
  readonly trail?: readonly BreadcrumbSegment[];
};

export const activeTabOf = (tabs: AppTabs): AppTab =>
  tabs.tabs.find((tab) => tab.id === tabs.activeId) ?? tabs.tabs[0];

const firstTabs = (id: string, place: Place): AppTabs => ({
  tabs: [{ id, title: null, ...place }],
  activeId: id,
});

const changeTab = (
  tabs: AppTabs,
  id: string | undefined,
  change: (tab: AppTab) => AppTab,
): AppTabs => ({
  ...tabs,
  tabs: tabs.tabs.map((tab) => (tab.id === id ? change(tab) : tab)),
});

export const visited = (
  tabs: AppTabs,
  place: Place,
  id: string | undefined = tabs.activeId,
): AppTabs =>
  changeTab(tabs, id, (tab) => ({ id: tab.id, title: tab.title, ...place }));

export const titled = (
  tabs: AppTabs,
  title: string,
  id: string | undefined = tabs.activeId,
): AppTabs =>
  changeTab(tabs, id, (tab) => (tab.title === title ? tab : { ...tab, title }));

export const opened = (tabs: AppTabs, id: string, path: string): AppTabs => ({
  ...tabs,
  tabs: [...tabs.tabs, { id, path, title: null }],
  activeId: id,
});

const opposite = (side: SplitSide): SplitSide =>
  side === 'left' ? 'right' : 'left';

const shownSideBySide = (
  tabs: readonly AppTab[],
  activeId: string,
  splitId: string | undefined,
  splitSide: SplitSide = 'right',
): AppTabs =>
  splitId && splitId !== activeId
    ? { tabs, activeId, splitId, splitSide }
    : { tabs, activeId };

export const panesOf = (tabs: AppTabs): Panes => {
  if (tabs.splitId === undefined) {
    return { left: tabs.activeId };
  }

  return tabs.splitSide === 'left'
    ? { left: tabs.splitId, right: tabs.activeId }
    : { left: tabs.activeId, right: tabs.splitId };
};

export const focused = (tabs: AppTabs, id: string): AppTabs =>
  id === tabs.splitId
    ? shownSideBySide(
        tabs.tabs,
        id,
        tabs.activeId,
        opposite(tabs.splitSide ?? 'right'),
      )
    : tabs;

export const selected = (tabs: AppTabs, id: string): AppTabs => {
  if (!tabs.tabs.some((tab) => tab.id === id)) {
    return tabs;
  }

  return id === tabs.splitId ? focused(tabs, id) : { ...tabs, activeId: id };
};

const neighbourOf = (tabs: AppTabs, id: string): AppTab | undefined => {
  const at = tabs.tabs.findIndex((tab) => tab.id === id);
  const rest = tabs.tabs.filter((tab) => tab.id !== id);

  return rest[Math.min(at, rest.length - 1)];
};

export const placed = (tabs: AppTabs, id: string, side: SplitSide): AppTabs => {
  const panes = panesOf(tabs);
  const there = panes[side];
  const other = opposite(side);

  if (!tabs.tabs.some((tab) => tab.id === id) || there === id) {
    return tabs;
  }

  const stays =
    panes[other] === id
      ? (there ?? neighbourOf(tabs, id)?.id)
      : (panes[other] ?? tabs.activeId);

  return stays ? shownSideBySide(tabs.tabs, id, stays, other) : tabs;
};

export const withoutPane = (tabs: AppTabs, side: SplitSide): AppTabs => {
  const kept = panesOf(tabs)[opposite(side)];

  return kept ? shownSideBySide(tabs.tabs, kept, undefined) : tabs;
};

export const moved = (tabs: AppTabs, id: string, to: string): AppTabs => {
  const from = tabs.tabs.findIndex((tab) => tab.id === id);
  const at = tabs.tabs.findIndex((tab) => tab.id === to);

  if (from === -1 || at === -1 || from === at) {
    return tabs;
  }

  const rest = tabs.tabs.filter((tab) => tab.id !== id);

  return {
    ...tabs,
    tabs: [...rest.slice(0, at), tabs.tabs[from], ...rest.slice(at)],
  };
};

export const closed = (tabs: AppTabs, id: string): AppTabs => {
  const neighbour = neighbourOf(tabs, id);

  if (!neighbour || !tabs.tabs.some((tab) => tab.id === id)) {
    return tabs;
  }

  const rest = tabs.tabs.filter((tab) => tab.id !== id);

  if (id === tabs.activeId) {
    return shownSideBySide(rest, tabs.splitId ?? neighbour.id, undefined);
  }

  return shownSideBySide(
    rest,
    tabs.activeId,
    id === tabs.splitId ? undefined : tabs.splitId,
    tabs.splitSide,
  );
};

const TEAM_PATTERNS = [
  '/w/:slug/team/:teamId/*',
  '/w/:slug/settings/team/:teamId/*',
];

const teamIdAt = (path: string): string | undefined =>
  TEAM_PATTERNS.map((pattern) => matchPath(pattern, path)).find(Boolean)?.params
    .teamId;

export const newTabPath = (
  slug: string,
  teams: readonly Team[],
  from: string,
): string => {
  const here = teamIdAt(from);
  const team = teams.find((each) => each.id === here) ?? teams[0];

  return team ? teamSectionPath(slug, team.id, 'agent') : inboxPath(slug);
};

const TAB_ICONS: readonly (readonly [string, LucideIcon])[] = [
  ['/w/:slug/inbox/*', Inbox],
  ['/w/:slug/settings/*', Settings2],
  ['/w/:slug/team/:teamId/agent/*', MousePointer2],
  ['/w/:slug/team/:teamId/runs/*', Play],
  ['/w/:slug/team/:teamId/insights/*', ChartNoAxesColumn],
  ['/w/:slug/team/:teamId/memory/*', Spool],
];

export const tabIconOf = (path: string): LucideIcon =>
  TAB_ICONS.find(([pattern]) => matchPath(pattern, path))?.[1] ?? Package;

const isTrail = (value: unknown): value is BreadcrumbSegment[] =>
  Array.isArray(value) &&
  value.every(
    (crumb) =>
      typeof crumb === 'object' &&
      crumb !== null &&
      typeof (crumb as BreadcrumbSegment).label === 'string',
  );

export const trailOf = (state: unknown): BreadcrumbSegment[] | undefined => {
  const trail = (state as { trail?: unknown } | null)?.trail;

  return isTrail(trail) && trail.length > 0 ? trail : undefined;
};

const tabOf = (value: unknown): AppTab | null => {
  const tab = value as Partial<Record<keyof AppTab, unknown>> | null;

  if (
    typeof tab !== 'object' ||
    tab === null ||
    typeof tab.id !== 'string' ||
    typeof tab.path !== 'string'
  ) {
    return null;
  }

  const trail = trailOf(tab);

  return {
    id: tab.id,
    path: tab.path,
    title: typeof tab.title === 'string' ? tab.title : null,
    ...(trail && { trail }),
  };
};

export const storedTabs = (
  stored: string | null,
  id: string,
  here: Place,
): AppTabs => {
  try {
    const parsed = JSON.parse(stored ?? 'null') as {
      tabs?: unknown;
      activeId?: unknown;
      splitId?: unknown;
      splitSide?: unknown;
    } | null;
    const tabs = Array.isArray(parsed?.tabs)
      ? parsed.tabs.map(tabOf).filter((tab): tab is AppTab => tab !== null)
      : [];
    const showing = tabs.find((tab) => tab.path === here.path);
    const active = tabs.find((tab) => tab.id === parsed?.activeId) ?? tabs[0];
    const split = tabs.find((tab) => tab.id === parsed?.splitId);

    if (!active) {
      return firstTabs(id, here);
    }

    const remembered = shownSideBySide(
      tabs,
      active.id,
      split?.id,
      parsed?.splitSide === 'left' ? 'left' : 'right',
    );

    return showing ? selected(remembered, showing.id) : remembered;
  } catch {
    return firstTabs(id, here);
  }
};
