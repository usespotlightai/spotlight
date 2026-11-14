import {
  ListTodo,
  type LucideIcon,
  MessageSquare,
  Play,
  Workflow,
} from 'lucide-react';
import { matchPath } from 'react-router';

import { pathnameOf, tabIconOf } from '@/lib/app-tabs';

export const RECENT_PAGES_KEY = 'spotlight.recent-pages';

export const RECENT_PAGES_LIMIT = 15;

export type RecentPage = {
  readonly path: string;
  readonly title: string | null;
  readonly label?: string;
};

export type PageDetails = {
  readonly title?: string;
  readonly label?: string;
};

type PageKind = { readonly label: string; readonly icon: LucideIcon };

const PAGE_KINDS: readonly (readonly [string, string, LucideIcon?])[] = [
  ['/w/:slug/team/:teamId/tasks/:taskId/trace', 'Trace', ListTodo],
  ['/w/:slug/team/:teamId/tasks/:taskId', 'Task', ListTodo],
  ['/w/:slug/team/:teamId/runs/:runId/*', 'Run', Play],
  ['/w/:slug/inbox/teams/:teamId/runs/:runId', 'Run', Play],
  ['/w/:slug/team/:teamId/lines/:lineId/*', 'Line', Workflow],
  ['/w/:slug/team/:teamId/agent/:chatId', 'Chat', MessageSquare],
  ['/w/:slug/inbox/teams/:teamId/chats/:chatId', 'Chat', MessageSquare],
  ['/w/:slug/team/:teamId/*', 'Team'],
  ['/w/:slug/inbox/*', 'Inbox'],
  ['/w/:slug/settings/*', 'Settings'],
];

export const kindOf = (path: string): PageKind => {
  const found = PAGE_KINDS.find(([pattern]) =>
    matchPath(pattern, pathnameOf(path)),
  );

  return { label: found?.[1] ?? 'Page', icon: found?.[2] ?? tabIconOf(path) };
};

const withoutHash = (path: string): string => path.split('#')[0] ?? path;

export const recorded = (
  pages: readonly RecentPage[],
  path: string,
): readonly RecentPage[] => {
  const key = withoutHash(path);
  const known = pages.find((page) => page.path === key);

  return [
    known ?? { path: key, title: null },
    ...pages.filter((page) => page.path !== key),
  ].slice(0, RECENT_PAGES_LIMIT);
};

export const described = (
  pages: readonly RecentPage[],
  path: string,
  details: PageDetails,
): readonly RecentPage[] => {
  const key = withoutHash(path);

  return pages.map((page) =>
    page.path === key ? { ...page, ...details } : page,
  );
};

export const forgotten = (
  pages: readonly RecentPage[],
  path: string,
): readonly RecentPage[] => {
  const key = withoutHash(path);

  return pages.filter((page) => page.path !== key);
};

const pageOf = (value: unknown): RecentPage | null => {
  const page = value as Partial<Record<keyof RecentPage, unknown>> | null;

  if (typeof page !== 'object' || page === null) {
    return null;
  }

  if (typeof page.path !== 'string' || page.path === '') {
    return null;
  }

  return {
    path: page.path,
    title: typeof page.title === 'string' ? page.title : null,
    ...(typeof page.label === 'string' && { label: page.label }),
  };
};

export const storedPages = (stored: string | null): readonly RecentPage[] => {
  try {
    const parsed: unknown = JSON.parse(stored ?? 'null');

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(pageOf)
      .filter((page): page is RecentPage => page !== null)
      .slice(0, RECENT_PAGES_LIMIT);
  } catch {
    return [];
  }
};
