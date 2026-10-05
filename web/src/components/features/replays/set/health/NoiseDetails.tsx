import { Fingerprint } from '@/components/shared/Fingerprint';
import { flippedTitles, type ReplaySet, type SetNoise } from '@/lib/replay';
import {
  eachCopyShown,
  FLIPPED_TASKS_LABEL,
  flippedShown,
  MEASURED_ON_CONFIG,
} from '@/lib/replay-words';
import { since } from '@/lib/since';

type NoiseDetailsProps = {
  set: ReplaySet;
  noise: SetNoise;
};

export function NoiseDetails({ set, noise }: NoiseDetailsProps) {
  const flipped = flippedTitles(set, noise);

  return (
    <div className="flex flex-col gap-1">
      <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs tabular-nums">
        <span>{eachCopyShown(noise.perRepeat)}</span>
        <span>· {flippedShown(flipped.length)}</span>
        <span className="flex items-center gap-1">
          · {MEASURED_ON_CONFIG} <Fingerprint fingerprint={noise.fingerprint} />{' '}
          {since(noise.measuredAt)}
        </span>
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
    </div>
  );
}
