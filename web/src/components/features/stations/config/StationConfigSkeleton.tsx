import { AuthoredText } from '@/components/features/stations/config/AuthoredText';
import { ImprovementProperties } from '@/components/features/stations/config/ImprovementProperties';
import { LineProperties } from '@/components/features/stations/config/LineProperties';
import { PromptSection } from '@/components/features/stations/config/PromptSection';
import { PROPERTY_GRID } from '@/components/features/stations/config/PropertyList';
import {
  CONFIG_LAYOUT,
  CONFIG_MAIN,
} from '@/components/features/stations/config/StationConfig';
import { PROPERTIES_LAYOUT } from '@/components/features/stations/config/StationProperties';
import { TabSection } from '@/components/features/stations/TabSection';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';

const PROMPT_LINES = [
  ['first', 'w-full'],
  ['second', 'w-11/12'],
  ['third', 'w-full'],
  ['fourth', 'w-3/4'],
  ['fifth', 'w-full'],
  ['sixth', 'w-1/2'],
] as const;

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

type StationConfigSkeletonProps = {
  line?: LineResponseDto;
  station?: StationResponseDto;
};

// What the line already says shows as is; the rest waits as low-fidelity rows.
const GROUPS_BEFORE_LINE = [
  ['Live config', [['Since', 'w-14']]],
  GROUPS[1],
] as const;

export function StationConfigSkeleton({
  line,
  station,
}: StationConfigSkeletonProps) {
  const groups = line && station ? GROUPS_BEFORE_LINE : GROUPS;

  return (
    <div className={CONFIG_LAYOUT}>
      <div className={CONFIG_MAIN}>
        {station ? (
          <PromptSection stationId={station.id} prompt={station.agentPrompt} />
        ) : (
          <TabSection title="Prompt">
            <AuthoredText>
              <div className="text-sm leading-5">
                {PROMPT_LINES.map(([key, width]) => (
                  <SkeletonLine key={key} className={width} />
                ))}
              </div>
            </AuthoredText>
          </TabSection>
        )}
        <TabSection title="Judge">
          <dl className={PROPERTY_GRID}>
            <dt className="text-muted-foreground">Judged</dt>
            <dd>
              <SkeletonLine className="w-24" />
            </dd>
            <dt className="text-muted-foreground">Passes when</dt>
            <dd>
              <SkeletonLine className="w-28" />
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
        {groups.map(([title, rows]) => (
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
        {line && station && (
          <>
            <LineProperties
              line={line}
              skills={station.skills}
              tools={station.tools}
            />
            {station.search && (
              <ImprovementProperties policy={station.search} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
