import { ListChecks } from 'lucide-react';
import { useState } from 'react';
import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { ComparedWith } from '@/components/features/replays/replay/ComparedWith';
import { EntryDetailOf } from '@/components/features/replays/replay/EntryDetailOf';
import { ReplayComparison } from '@/components/features/replays/replay/ReplayComparison';
import { ReplayHeader } from '@/components/features/replays/replay/ReplayHeader';
import { StateBox } from '@/components/features/replays/StateBox';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';
import {
  baselineIn,
  type Replay,
  type ReplayDetail,
  type ReplayedStation,
  type ReplaySet,
  replaySetPath,
} from '@/lib/replay';
import { TrailContext } from '@/lib/trail';
import { cn } from '@/lib/utils';

type ReplayPageProps = {
  at: ReplayedStation;
  replay: ReplayDetail;
  set: ReplaySet;
  siblings: readonly Replay[];
  trail: BreadcrumbSegment[];
  forward: BreadcrumbSegment[];
};

export function ReplayPage({
  at,
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

  return (
    <TrailContext value={forward}>
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <StationLayout
        aside={
          <EntryDetailOf
            slug={at.slug}
            teamId={at.teamId}
            chosen={chosen}
            onClose={() => setPicked(null)}
          />
        }
      >
        <ReplayHeader
          at={at}
          replay={replay}
          setName={set.name}
          baseline={baseline}
        />

        <section aria-labelledby="task-by-task" className="flex flex-col gap-2">
          <ReplaysHeading title="Task by task" id="task-by-task" level="h2" />
          <ComparedWith at={at} replay={replay} />

          {replay.comparison.length === 0 ? (
            <StateBox>
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
              slug={at.slug}
              teamId={at.teamId}
              replay={replay}
              picked={chosen?.originalRunId ?? null}
              onPick={(id) => setPicked((was) => (was === id ? null : id))}
            />
          )}
        </section>
      </StationLayout>
    </TrailContext>
  );
}
