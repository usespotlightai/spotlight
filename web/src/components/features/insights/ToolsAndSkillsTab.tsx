import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { MemoryTab } from '@/components/features/insights/memory/MemoryTab';
import { ToolsTab } from '@/components/features/insights/tools/ToolsTab';
import type { InsightsPeriod, StationNames } from '@/lib/insights';

type ToolsAndSkillsTabProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  names: StationNames;
};

export function ToolsAndSkillsTab(props: ToolsAndSkillsTabProps) {
  return (
    <>
      <InsightsSection title="Skills and tools">
        <ToolsTab {...props} />
      </InsightsSection>

      <InsightsSection title="Memory">
        <MemoryTab
          slug={props.slug}
          teamId={props.teamId}
          period={props.period}
        />
      </InsightsSection>
    </>
  );
}
