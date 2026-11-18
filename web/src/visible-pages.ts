import { createElement, isValidElement } from 'react';
import {
  createRoutesFromElements,
  matchRoutes,
  Route,
  type RouteObject,
} from 'react-router';

import { APP_TABS_KEY, panesOf, placeAt, storedTabs } from './lib/app-tabs.ts';
import { isLazyPage } from './lib/lazy-page.ts';
import { workspacePages } from './workspace-pages.tsx';

const WORKSPACE_PATH = /^\/w\/([^/]+)/;

const workspaceRoutes = (): RouteObject[] =>
  createRoutesFromElements(
    createElement(Route, { path: '/w/:slug' }, workspacePages),
  );

const storedTabsOf = (slug: string): string | null => {
  try {
    return localStorage.getItem(`${APP_TABS_KEY}.${slug}`);
  } catch {
    return null;
  }
};

export const visiblePaths = (
  pathname: string,
  stored: (slug: string) => string | null = storedTabsOf,
): string[] => {
  const slug = WORKSPACE_PATH.exec(pathname)?.[1];

  if (!slug) {
    return [pathname];
  }

  const tabs = storedTabs(stored(slug), 'shown', placeAt(pathname, null));
  const { left, right } = panesOf(tabs);
  const paths = [left, right].flatMap((id) => {
    const tab = tabs.tabs.find((each) => each.id === id);
    return tab ? [new URL(tab.path, 'http://pane').pathname] : [];
  });

  return [...new Set([pathname, ...paths])];
};

export const pagesAt = (
  paths: readonly string[],
  routes: RouteObject[] = workspaceRoutes(),
) =>
  paths
    .flatMap((path) => matchRoutes(routes, path) ?? [])
    .map(({ route }) => route.element)
    .flatMap((element) =>
      isValidElement(element) && isLazyPage(element.type) ? [element.type] : [],
    );

export const preloadVisiblePages = (pathname: string): Promise<unknown> =>
  Promise.all(
    pagesAt(visiblePaths(pathname)).map((page) => page.preload()),
  ).catch(() => undefined);
