import { createContext, useContext } from 'react';
import { useLocation } from 'react-router';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';

type TrailState = { trail?: BreadcrumbSegment[] };

/**
 * The breadcrumb a page shows, and the one it hands to pages opened from it.
 * Ancestors come from the trail the page was reached by (navigation state), or
 * from `base` when none was carried. `own` is how many trailing crumbs belong
 * to the page itself and so are kept whatever the trail — a run owns two, its
 * task and its station.
 */
export function useTrail(
  base: readonly BreadcrumbSegment[],
  own = 1,
): {
  trail: BreadcrumbSegment[];
  forward: BreadcrumbSegment[];
} {
  const location = useLocation();
  const carried = (location.state as TrailState | null)?.trail;
  const mine = base.slice(-own);
  const ancestors =
    carried && carried.length > 0
      ? carried
      : base.slice(0, Math.max(base.length - own, 0));

  const here = `${location.pathname}${location.search}`;
  const forwardMine = mine.map((crumb, index) =>
    index === mine.length - 1
      ? { label: crumb.label, avatar: crumb.avatar, to: here }
      : crumb,
  );

  return {
    trail: collapse([...ancestors, ...mine]),
    forward: collapse([...ancestors, ...forwardMine]),
  };
}

/** Adjacent crumbs leading to the same place are one: a page reached through a
 *  crumb it also owns would otherwise name it twice. */
const collapse = (segments: BreadcrumbSegment[]): BreadcrumbSegment[] =>
  segments.filter(
    (crumb, index) =>
      !(index > 0 && crumb.to && segments[index - 1]?.to === crumb.to),
  );

/** What a page hands to the pages opened from within it. */
export const TrailContext = createContext<BreadcrumbSegment[]>([]);

export const useForwardTrail = (): BreadcrumbSegment[] =>
  useContext(TrailContext);
