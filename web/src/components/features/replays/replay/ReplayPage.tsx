import { ListChecks } from 'lucide-react';
import { useState } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { EntryDetailOf } from '@/components/features/replays/replay/EntryDetailOf';
import { ReplayComparison } from '@/components/features/replays/replay/ReplayComparison';
import { ReplayHeading } from '@/components/features/replays/replay/ReplayHeading';
import { ReplayTiles } from '@/components/features/replays/replay/ReplayTiles';
import { StopReplayButton } from '@/components/features/replays/replay/StopReplayButton';
import { StateBox } from '@/components/features/replays/StateBox';
import { StationPane } from '@/components/features/stations/StationPane';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';

import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import {
  baselineIn,
  type Replay,
  type ReplayDetail,
  type ReplayedStation,
  type ReplaySet,
  replaySetPath,
  taskColumnsOf,
  underway,
} from '@/lib/replay';

import { tasksNoteShown } from '@/lib/replay-words';
import { TrailContext } from '@/lib/trail';
import { cn } from '@/lib/utils';

type ReplayPageProps = {
  at: ReplayedStation;
  line: LineResponseDto | undefined;
  station: StationResponseDto | undefined;
  replay: ReplayDetail;
  set: ReplaySet;
  siblings: readonly Replay[];
  trail: BreadcrumbSegment[];
  forward: BreadcrumbSegment[];
};

export function ReplayPage({
  at,
  line,
  station,
  replay,
  set,
  siblings,
  trail,
  forward,
}: ReplayPageProps) {
  const [picked, setPicked] = useState<string | null>(null);

  const baseline =
    baselineIn(siblings) ??
    (replay.baselineReplayId === replay.id ? replay : null);
  const chosen =
    replay.comparison.find((each) => each.originalRunId === picked) ?? null;
  const { compared, counterpart } = taskColumnsOf(replay);

  return (
    <TrailContext value={forward}>
      <PageHeader
        title={<Breadcrumbs segments={trail} />}
        bordered={false}
        actions={
          underway(replay.state) && (
            <StopReplayButton teamId={at.teamId} replayId={replay.id} />
          )
        }
      />

      <ReplayHeading
        at={at}
        line={line}
        station={station}
        replay={replay}
        setName={set.name}
      />

      <StationPane
        aside={
          <EntryDetailOf
            slug={at.slug}
            teamId={at.teamId}
            chosen={chosen}
            onClose={() => setPicked(null)}
          />
        }
      >
        <ReplayTiles replay={replay} baseline={baseline} />

        <InsightsCard
          tableOnly
          title="Tasks"
          description={tasksNoteShown(compared ? counterpart : null)}
        >
          {replay.comparison.length === 0 ? (
            <StateBox flat>
              <EmptyState
                icon={ListChecks}
                title="No tasks in this replay"
                action={
                  <TrailLink
                    to={replaySetPath(at, replay.setId)}
                    className={cn(
                      buttonVariants({ size: 'sm' }),
                      'rounded-full',
                    )}
                  >
                    Open the set
                  </TrailLink>
                }
              >
                Set had no runs when this replay started. Add runs to the set,
                then replay it again.
              </EmptyState>
            </StateBox>
          ) : (
            <ReplayComparison
              replay={replay}
              picked={chosen?.originalRunId ?? null}
              onPick={(id) => setPicked((was) => (was === id ? null : id))}
            />
          )}
        </InsightsCard>
      </StationPane>
    </TrailContext>
  );
}
