import { PROPERTY_GRID } from '@/components/features/stations/config/PropertyList';
import {
  CONFIG_LAYOUT,
  CONFIG_MAIN,
} from '@/components/features/stations/config/StationConfig';
import { TabSection } from '@/components/features/stations/TabSection';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { cn } from '@/lib/utils';

const PROMPT = ['w-1/4', 'w-full', 'w-5/6', 'w-full', 'w-2/3', 'w-3/4'];

const GROUPS = [
  ['Live config', [['Since', 'w-14']]],
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
] as const;

export function StationConfigSkeleton() {
  return (
    <div className={CONFIG_LAYOUT}>
      <div className={CONFIG_MAIN}>
        <TabSection title="Prompt">
          <div className="flex flex-col border-border border-l-2 pl-4">
            {PROMPT.map((width, at) => (
              <SkeletonLine
                // biome-ignore lint/suspicious/noArrayIndexKey: placeholder lines have no identity
                key={at}
                className={cn(width, 'text-sm leading-6')}
              />
            ))}
          </div>
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

      <div className="grid content-start gap-10 max-lg:order-first sm:max-lg:grid-cols-2">
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
