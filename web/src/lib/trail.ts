import { createContext, useContext } from 'react';
import { useLocation } from 'react-router';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';

type TrailState = { trail?: BreadcrumbSegment[] };

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

const collapse = (segments: BreadcrumbSegment[]): BreadcrumbSegment[] =>
  segments.filter(
    (crumb, index) =>
      !(index > 0 && crumb.to && segments[index - 1]?.to === crumb.to),
  );

export const TrailContext = createContext<BreadcrumbSegment[]>([]);

export const useForwardTrail = (): BreadcrumbSegment[] =>
  useContext(TrailContext);
