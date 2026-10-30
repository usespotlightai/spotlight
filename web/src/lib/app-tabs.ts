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
};

export type Place = {
  readonly path: string;
  readonly trail?: readonly BreadcrumbSegment[];
};

export const activeTabOf = (tabs: AppTabs): AppTab =>
  tabs.tabs.find((tab) => tab.id === tabs.activeId) ?? (tabs.tabs[0] as AppTab);

const firstTabs = (id: string, place: Place): AppTabs => ({
  tabs: [{ id, title: null, ...place }],
  activeId: id,
});

const changeActive = (
  tabs: AppTabs,
  change: (tab: AppTab) => AppTab,
): AppTabs => ({
  ...tabs,
  tabs: tabs.tabs.map((tab) => (tab.id === tabs.activeId ? change(tab) : tab)),
});

export const visited = (tabs: AppTabs, place: Place): AppTabs =>
  changeActive(tabs, (tab) => ({ id: tab.id, title: tab.title, ...place }));

export const titled = (tabs: AppTabs, title: string): AppTabs =>
  changeActive(tabs, (tab) => (tab.title === title ? tab : { ...tab, title }));

export const opened = (tabs: AppTabs, id: string, path: string): AppTabs => ({
  tabs: [...tabs.tabs, { id, path, title: null }],
  activeId: id,
});

export const selected = (tabs: AppTabs, id: string): AppTabs =>
  tabs.tabs.some((tab) => tab.id === id) ? { ...tabs, activeId: id } : tabs;

export const closed = (tabs: AppTabs, id: string): AppTabs => {
  const at = tabs.tabs.findIndex((tab) => tab.id === id);

  if (at === -1 || tabs.tabs.length === 1) {
    return tabs;
  }

  const rest = tabs.tabs.filter((tab) => tab.id !== id);
  const neighbour = rest[Math.min(at, rest.length - 1)] as AppTab;

  return {
    tabs: rest,
    activeId: tabs.activeId === id ? neighbour.id : tabs.activeId,
  };
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
    } | null;
    const tabs = Array.isArray(parsed?.tabs)
      ? parsed.tabs.map(tabOf).filter((tab): tab is AppTab => tab !== null)
      : [];
    const showing = tabs.find((tab) => tab.path === here.path);
    const active =
      showing ?? tabs.find((tab) => tab.id === parsed?.activeId) ?? tabs[0];

    return active ? { tabs, activeId: active.id } : firstTabs(id, here);
  } catch {
    return firstTabs(id, here);
  }
};
