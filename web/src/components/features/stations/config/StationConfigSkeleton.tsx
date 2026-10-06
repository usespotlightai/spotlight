import { SettingRowsSkeleton } from '@/components/features/stations/config/SettingRowsSkeleton';
import { StationSection } from '@/components/features/stations/StationSection';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function StationConfigSkeleton() {
  return (
    <>
      <SkeletonLine className="w-56 text-sm leading-6" />

      <StationSection title="Agent">
        <SettingRowsSkeleton rows={['Harness', 'Model', 'Effort', 'Skills']} />
      </StationSection>

      <StationSection title="Prompt">
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 text-sm leading-6">
          <SkeletonLine className="w-16" />
          <SkeletonLine className="w-2/3" />
          <SkeletonLine className="w-1/2" />
        </div>
      </StationSection>

      <StationSection title="Judge">
        <SettingRowsSkeleton rows={['Judges', 'Threshold']} />
      </StationSection>

      <StationSection title="From the line">
        <SettingRowsSkeleton
          rows={['Repositories', 'Source', 'Replay check']}
        />
      </StationSection>
    </>
  );
}
