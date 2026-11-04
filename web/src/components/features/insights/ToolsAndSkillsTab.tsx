import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { MemoryTab } from '@/components/features/insights/memory/MemoryTab';
import { OVERVIEW_LAYOUT } from '@/components/features/insights/overview-layout';
import { ToolsAndSkillsSkeleton } from '@/components/features/insights/ToolsAndSkillsSkeleton';
import { ToolsTab } from '@/components/features/insights/tools/ToolsTab';
import { useInsightsMemory } from '@/hooks/api/useInsightsMemory';
import { useInsightsTools } from '@/hooks/api/useInsightsTools';
import type { InsightsPeriod, StationNames } from '@/lib/insights';
import { loading } from '@/lib/query';

type ToolsAndSkillsTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
};

export function ToolsAndSkillsTab(props: ToolsAndSkillsTabProps) {
  const queries = [
    useInsightsTools(props.teamId, props.period),
    useInsightsMemory(props.teamId, props.period),
  ];

  if (queries.some(loading)) {
    return <ToolsAndSkillsSkeleton />;
  }

  return (
    <div className={OVERVIEW_LAYOUT}>
      <ToolsTab {...props} />

      <InsightsSection title="Memory">
        <MemoryTab
          slug={props.slug}
          teamId={props.teamId}
          period={props.period}
        />
      </InsightsSection>
    </div>
  );
}
