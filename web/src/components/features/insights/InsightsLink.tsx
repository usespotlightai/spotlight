import type { ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  type InsightsFilter,
  type InsightsTab,
  insightsPath,
  viewOf,
} from '@/lib/insights';
import { cn } from '@/lib/utils';

type InsightsLinkProps = {
  tab: InsightsTab;
  filter?: InsightsFilter;
  className?: string;
  children: ReactNode;
};

export function InsightsLink({
  tab,
  filter = {},
  className,
  children,
}: InsightsLinkProps) {
  const { slug = '', teamId = '' } = useParams();
  const [params] = useSearchParams();
  const { period } = viewOf(params);

  return (
    <Link
      to={insightsPath(slug, teamId, { tab, period, filter, page: 1 })}
      className={cn(
        'rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      {children}
    </Link>
  );
}
