import { ImproveCardSkeleton } from '@/components/features/stations/improve/ImproveCardSkeleton';
import { ImproveSection } from '@/components/features/stations/improve/ImproveSection';

export function StationImproveSkeleton() {
  return (
    <>
      <ImproveSection title="What stands out">
        <ImproveCardSkeleton
          label="Loading the station’s signals"
          rows={2}
          rowHeight={40}
        />
      </ImproveSection>

      <ImproveSection title="Try a change">
        <div className="grid gap-3 lg:grid-cols-2">
          <ImproveCardSkeleton
            label="Loading the replay sets"
            rows={2}
            footer
          />
          <ImproveCardSkeleton label="Loading the searches" rows={2} footer />
        </div>
      </ImproveSection>
    </>
  );
}
