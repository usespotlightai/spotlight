import { ListChecks } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { EntryDetailOf } from '@/components/features/replays/replay/EntryDetailOf';
import { ReplayComparison } from '@/components/features/replays/replay/ReplayComparison';
import { ReplayHeader } from '@/components/features/replays/replay/ReplayHeader';
import { ReplaySkeleton } from '@/components/features/replays/replay/ReplaySkeleton';
import { StateBox } from '@/components/features/replays/StateBox';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageNotice } from '@/components/shared/PageNotice';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button';
import { useReplay } from '@/hooks/api/useReplay';
import { useTeamReplaySets } from '@/hooks/api/useReplaySets';
import { useReplays } from '@/hooks/api/useReplays';
import { useStationTrail } from '@/hooks/useStationTrail';
import { notFound } from '@/lib/error';
import { failed, loading } from '@/lib/query';
import {
  baselineIn,
  candidateShown,
  replayPath,
  replaySetPath,
  successAgainst,
} from '@/lib/replay';
import { TrailContext, useTrail } from '@/lib/trail';
import { cn } from '@/lib/utils';

export function Replay() {
  const { slug, teamId, lineId, stationId, replayId } = useParams();
  const stationTrail = useStationTrail({ slug, teamId, lineId, stationId });
  const replay = useReplay(teamId, replayId);
  const sets = useTeamReplaySets(teamId);
  const siblings = useReplays(teamId, replay.data?.setId);
  const [picked, setPicked] = useState<string | null>(null);

  const found = replay.data;
  const set = sets.data?.find(
    (candidate) =>
      candidate.id === found?.setId &&
      candidate.lineId === lineId &&
      candidate.stationId === stationId,
  );
  const at =
    slug && teamId && lineId && stationId
      ? { slug, teamId, lineId, stationId }
      : null;

  const base: BreadcrumbSegment[] = [
    ...stationTrail,
    ...(set && at ? [{ label: set.name, to: replaySetPath(at, set.id) }] : []),
    ...(found && at
      ? [
          {
            label: candidateShown(found.candidate),
            to: replayPath(at, found.id),
          },
        ]
      : []),
  ];
  const { trail, forward } = useTrail(base);

  if (loading(replay) || loading(sets)) {
    return <ReplaySkeleton known={trail} />;
  }

  if (failed(replay) && !(notFound(replay.error) && sets.data)) {
    return (
      <PageNotice>
        {notFound(replay.error) ? (
          <MembersOnly title="Only the team’s members can see its replays" />
        ) : (
          <CouldNotLoad
            what="The replay"
            retrying={replay.isFetching}
            onRetry={() => void replay.refetch()}
          />
        )}
      </PageNotice>
    );
  }

  if (!found || !set || !at) {
    return (
      <PageNotice title="Replay not found">
        <p className="text-muted-foreground text-sm">
          There is no replay at that address.
        </p>
      </PageNotice>
    );
  }

  const baseline =
    baselineIn(siblings.data ?? []) ??
    (found.baselineReplayId === found.id ? found : null);
  const chosen =
    found.comparison.find((each) => each.originalRunId === picked) ?? null;

  return (
    <TrailContext value={forward}>
      <PageHeader title={<Breadcrumbs segments={trail} />} />

      <div className="flex min-h-0 flex-1">
        <StationLayout>
          <ReplayHeader
            at={at}
            replay={found}
            setName={set?.name ?? null}
            success={successAgainst(found, baseline)}
          />

          <section
            aria-labelledby="task-by-task"
            className="flex flex-col gap-2"
          >
            <ReplaysHeading title="Task by task" id="task-by-task" level="h2" />

            {found.comparison.length === 0 ? (
              <StateBox>
                <EmptyState
                  icon={ListChecks}
                  title="No tasks in this replay"
                  action={
                    <TrailLink
                      to={replaySetPath(at, found.setId)}
                      className={cn(
                        buttonVariants({ size: 'sm' }),
                        'rounded-full',
                      )}
                    >
                      Open the set
                    </TrailLink>
                  }
                >
                  The set had no runs when this replay started.
                </EmptyState>
              </StateBox>
            ) : (
              <ReplayComparison
                slug={at.slug}
                teamId={at.teamId}
                replay={found}
                picked={chosen?.originalRunId ?? null}
                onPick={(id) => setPicked((was) => (was === id ? null : id))}
              />
            )}
          </section>
        </StationLayout>

        <EntryDetailOf
          slug={at.slug}
          teamId={at.teamId}
          chosen={chosen}
          onClose={() => setPicked(null)}
        />
      </div>
    </TrailContext>
  );
}
