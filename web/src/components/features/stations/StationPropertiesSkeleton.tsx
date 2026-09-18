import { CodeXml, GitBranch, SquareMousePointer } from 'lucide-react';
import { StationAside } from '@/components/features/stations/StationAside';
import { StationPropertiesSection } from '@/components/features/stations/StationPropertiesSection';
import { PropertySkeleton } from '@/components/shared/skeleton/PropertySkeleton';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';

const ICON = 'size-3.5 shrink-0 text-muted-foreground';

export function StationPropertiesSkeleton() {
  return (
    <StationAside>
      <StationPropertiesSection title="Worked by">
        <PropertySkeleton
          lead={<Skeleton className="size-3.5 rounded-sm" />}
          width="w-24"
        />
        <PropertySkeleton
          lead={<CodeXml className={ICON} aria-hidden />}
          width="w-20"
        />
      </StationPropertiesSection>

      <StationPropertiesSection title="Skills">
        <PropertySkeleton
          lead={<SquareMousePointer className={ICON} aria-hidden />}
          width="w-24"
        />
      </StationPropertiesSection>

      <StationPropertiesSection title="Line Repositories">
        <PropertySkeleton
          lead={<GitBranch className={ICON} aria-hidden />}
          width="w-28"
        />
      </StationPropertiesSection>
    </StationAside>
  );
}
