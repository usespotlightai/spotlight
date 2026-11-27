import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { MemorySkeleton } from '@/components/features/insights/memory/MemorySkeleton';
import { OVERVIEW_LAYOUT } from '@/components/features/insights/overview-layout';
import { ToolsSkeleton } from '@/components/features/insights/tools/ToolsSkeleton';

export function ToolsAndSkillsSkeleton() {
  return (
    <div className={OVERVIEW_LAYOUT}>
      <ToolsSkeleton />

      <InsightsSection title="Memory">
        <MemorySkeleton />
      </InsightsSection>
    </div>
  );
}
