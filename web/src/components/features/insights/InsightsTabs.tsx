import { Link } from 'react-router';
import { INSIGHTS_TABS, type InsightsView, insightsPath } from '@/lib/insights';
import { cn } from '@/lib/utils';

type InsightsTabsProps = {
  slug: string;
  teamId: string;
  view: InsightsView;
};

export function InsightsTabs({ slug, teamId, view }: InsightsTabsProps) {
  return (
    <nav
      aria-label="Insights"
      className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto px-3"
    >
      {INSIGHTS_TABS.map((tab) => (
        <Link
          key={tab.id}
          to={insightsPath(slug, teamId, {
            tab: tab.id,
            period: view.period,
            filter: {},
            page: 1,
          })}
          replace
          aria-current={tab.id === view.tab ? 'page' : undefined}
          className={cn(
            'flex h-7 shrink-0 items-center rounded-full border border-border bg-card px-2.5 font-medium text-[0.8rem] shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50',
            tab.id === view.tab && 'bg-muted',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
