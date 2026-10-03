import { Activity } from 'lucide-react';
import { StartReplayButton } from '@/components/features/replays/set/StartReplayButton';
import { Fingerprint } from '@/components/shared/Fingerprint';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  flippedTitles,
  LIVE,
  NOISE_REPEATS,
  type Replay,
  type ReplayedStation,
  type ReplaySet,
  replayPath,
  startRefusal,
} from '@/lib/replay';
import {
  eachCopyShown,
  FLIPPED_TASKS_LABEL,
  flippedShown,
  MEASURE_NOISE,
  MEASURED_ON_CONFIG,
  NOISE_LABEL,
  NOISE_REPLAY_LINK,
  NOISE_UNMEASURED,
  NOISE_UNMEASURED_NOTE,
  noiseAgainstShown,
  noiseShown,
} from '@/lib/replay-words';
import { since } from '@/lib/runner';

type SetNoiseProps = {
  at: ReplayedStation;
  set: ReplaySet;
  baseline: Pick<Replay, 'repeats'> | null;
};

export function SetNoise({ at, set, baseline }: SetNoiseProps) {
  const noise = set.noise;
  const flipped = noise ? flippedTitles(set, noise) : [];

  return (
    <section
      aria-label={NOISE_LABEL}
      data-slot="set-noise"
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5"
    >
      <div className="flex flex-wrap items-start gap-2">
        <span className="font-medium text-foreground text-xs">
          {NOISE_LABEL}
        </span>
        <span className="text-foreground text-xs">
          {noise ? noiseShown(noise) : NOISE_UNMEASURED}
        </span>
        <span className="ml-auto">
          <StartReplayButton
            at={at}
            set={set}
            baseline={baseline}
            refusedBecause={startRefusal(set)}
            label={MEASURE_NOISE}
            icon={Activity}
            variant="outline"
            firstRepeats={NOISE_REPEATS}
            firstCandidate={LIVE}
          />
        </span>
      </div>

      {noise ? (
        <>
          <p className="text-muted-foreground text-xs leading-5">
            {noiseAgainstShown(noise, set.minGain)}.
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs tabular-nums">
            <span>{eachCopyShown(noise.perRepeat)}</span>
            <span>· {flippedShown(flipped.length)}</span>
            <span className="flex items-center gap-1">
              · {MEASURED_ON_CONFIG}{' '}
              <Fingerprint fingerprint={noise.fingerprint} />{' '}
              {since(noise.measuredAt)}
            </span>
            <TrailLink
              to={replayPath(at, noise.replayId)}
              className="text-foreground underline-offset-2 hover:underline"
            >
              {NOISE_REPLAY_LINK}
            </TrailLink>
          </p>
          {flipped.length > 0 && (
            <ul
              aria-label={FLIPPED_TASKS_LABEL}
              className="flex flex-wrap gap-x-3 text-muted-foreground text-xs"
            >
              {flipped.map((title, place) => (
                <li key={noise.flippedTasks[place]}>{title}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-muted-foreground text-xs leading-5">
          {NOISE_UNMEASURED_NOTE}
        </p>
      )}
    </section>
  );
}
