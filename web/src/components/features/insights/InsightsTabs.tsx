import { TabLinks } from '@/components/shared/TabLinks';
import { INSIGHTS_TABS, type InsightsView, insightsPath } from '@/lib/insights';

type InsightsTabsProps = {
  slug: string;
  teamId: string;
  view: InsightsView;
};

export function InsightsTabs({ slug, teamId, view }: InsightsTabsProps) {
  return (
    <TabLinks
      label="Insights"
      current={view.tab}
      variant="underline"
      className="border-border border-b px-3"
      tabs={INSIGHTS_TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        to: insightsPath(slug, teamId, {
          tab: tab.id,
          period: view.period,
          filter: {},
          page: 1,
        }),
      }))}
    />
  );
}
