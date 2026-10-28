import { Repeat } from 'lucide-react';
import { SearchOrigin } from '@/components/features/searches/SearchOrigin';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useReplayOfRun } from '@/hooks/api/useReplayOfRun';
import { loading } from '@/lib/query';
import {
  formatCandidate,
  formatTitle,
  type ReplayRun,
  replayPath,
} from '@/lib/replay';
import { runPath } from '@/lib/run';

const LINK = 'text-foreground underline-offset-2 hover:underline';

type ReplayRunBannerProps = {
  slug: string;
  teamId: string;
  run: ReplayRun;
};

export function ReplayRunBanner({ slug, teamId, run }: ReplayRunBannerProps) {
  const replay = useReplayOfRun(teamId, run.id);
  const of = replay.data;

  return (
    <div
      data-slot="replay-run-banner"
      className="flex flex-col gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
    >
      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5">
        <Repeat aria-hidden className="size-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">A replay of</span>
        <TrailLink
          to={runPath(slug, teamId, run.original.runId)}
          className={LINK}
        >
          {formatTitle(run.original.title)}
        </TrailLink>
      </p>

      {loading(replay) ? (
        <SkeletonLine className="w-48 text-xs" />
      ) : of ? (
        <div className="flex flex-col gap-1 text-xs">
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-muted-foreground">
            <span>Under</span>
            <span className="text-foreground">
              {formatCandidate(of.candidate)}
            </span>
            {of.isBaseline && <span>(the baseline)</span>}
            {of.search && (
              <span>
                ·{' '}
                <SearchOrigin
                  at={{
                    slug,
                    teamId,
                    lineId: of.lineId,
                    stationId: of.stationId,
                  }}
                  search={of.search}
                />
              </span>
            )}
            <span>in</span>
            <TrailLink
              to={replayPath(
                { slug, teamId, lineId: of.lineId, stationId: of.stationId },
                of.replayId,
              )}
              className={LINK}
            >
              its replay
            </TrailLink>
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Sorry, the replay couldn’t be loaded. Please try again later.
        </p>
      )}
    </div>
  );
}
