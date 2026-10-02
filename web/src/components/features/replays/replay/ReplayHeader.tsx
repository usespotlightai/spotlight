import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { ReplaySpend } from '@/components/features/replays/replay/ReplaySpend';
import { StopReplayButton } from '@/components/features/replays/replay/StopReplayButton';
import { SuccessAgainstBaseline } from '@/components/features/replays/SuccessAgainstBaseline';
import { Fingerprint } from '@/components/shared/Fingerprint';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  candidateShown,
  type ReplayDetail,
  type ReplayedStation,
  replaySetPath,
  type SuccessComparison,
  scoredShown,
  underway,
} from '@/lib/replay';
import { stateNote } from '@/lib/replay-words';
import { since } from '@/lib/runner';

type ReplayHeaderProps = {
  at: ReplayedStation;
  replay: ReplayDetail;
  setName: string | null;
  success: SuccessComparison;
};

export function ReplayHeader({
  at,
  replay,
  setName,
  success,
}: ReplayHeaderProps) {
  const note = stateNote(replay.state);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-2">
        <h1 className="min-w-0 break-words font-semibold text-2xl text-foreground leading-8 tracking-tight">
          {candidateShown(replay.candidate)}
        </h1>
        <ReplayStatePill state={replay.state} className="mt-1" />
        {underway(replay.state) && (
          <StopReplayButton
            teamId={at.teamId}
            replayId={replay.id}
            className="ml-auto"
          />
        )}
      </div>

      <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs">
        <span>
          Replays{' '}
          <TrailLink
            to={replaySetPath(at, replay.setId)}
            className="text-foreground underline-offset-2 hover:underline"
          >
            {setName ?? 'its set'}
          </TrailLink>
        </span>
        <span>· started {since(replay.startedAt)}</span>
        {replay.candidate && (
          <span className="flex items-center gap-1">
            · config <Fingerprint fingerprint={replay.candidate.fingerprint} />
          </span>
        )}
        {note && <span>· {note}</span>}
      </p>

      {replay.isBaseline && (
        <p className="text-muted-foreground text-sm">
          This is the set’s baseline: the live config, which every other replay
          of the set is compared against.
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground text-xs">Success</dt>
        <dd>
          <SuccessAgainstBaseline
            success={success}
            isBaseline={replay.isBaseline}
          />
        </dd>

        <dt className="text-muted-foreground text-xs">Scored</dt>
        <dd className="text-foreground text-xs tabular-nums">
          {scoredShown(replay.totals)}
          <span className="text-muted-foreground">
            {' '}
            · {scoringShown(replay)}
          </span>
        </dd>

        <dt className="text-muted-foreground text-xs">Spent</dt>
        <dd>
          <ReplaySpend replay={replay} />
        </dd>
      </dl>
    </div>
  );
}

const scoringShown = (replay: ReplayDetail): string => {
  if (replay.checks && replay.judges) {
    return 'by its checks and its judge';
  }
  if (replay.checks) {
    return 'by its checks';
  }

  return replay.judges ? 'by its judge' : 'nothing scores this station';
};
