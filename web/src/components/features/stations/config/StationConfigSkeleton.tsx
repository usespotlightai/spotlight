import { PROPERTY_GRID } from '@/components/features/stations/config/PropertyList';
import {
  CONFIG_LAYOUT,
  CONFIG_MAIN,
} from '@/components/features/stations/config/StationConfig';
import { PROPERTIES_LAYOUT } from '@/components/features/stations/config/StationProperties';
import { TabSection } from '@/components/features/stations/TabSection';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

const GROUPS = [
  [
    'Live config',
    [
      ['Since', 'w-14'],
      ['Change', 'w-24'],
    ],
  ],
  [
    'Agent',
    [
      ['Harness', 'w-24'],
      ['Model', 'w-16'],
      ['Effort', 'w-14'],
    ],
  ],
  [
    'Line',
    [
      ['Name', 'w-16'],
      ['Repositories', 'w-28'],
      ['Skills', 'w-24'],
    ],
  ],
  [
    'Automatic improvement',
    [
      ['Searches', 'w-28'],
      ['Budget', 'w-20'],
    ],
  ],
] as const;

export function StationConfigSkeleton() {
  return (
    <div className={CONFIG_LAYOUT}>
      <div className={CONFIG_MAIN}>
        <TabSection title="Prompt">
          <Skeleton className="h-40 w-full rounded-lg" />
        </TabSection>
        <TabSection title="Judge">
          <dl className={PROPERTY_GRID}>
            <dt className="text-muted-foreground">Scores</dt>
            <dd>
              <SkeletonLine className="w-24" />
            </dd>
            <dt className="text-muted-foreground">Agreement</dt>
            <dd>
              <SkeletonLine className="w-24" />
            </dd>
            <dt className="text-muted-foreground">Minimum agreement</dt>
            <dd>
              <SkeletonLine className="w-10" />
            </dd>
          </dl>
        </TabSection>
      </div>

      <div className={PROPERTIES_LAYOUT}>
        {GROUPS.map(([title, rows]) => (
          <TabSection key={title} level={3} title={title}>
            <dl className={PROPERTY_GRID}>
              {rows.map(([label, width]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>
                    <SkeletonLine className={width} />
                  </dd>
                </div>
              ))}
            </dl>
          </TabSection>
        ))}
      </div>
    </div>
  );
}
