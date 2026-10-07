import { ShieldCheck } from 'lucide-react';
import { spentIn } from '@/lib/inbox';
import { minGainSentence } from '@/lib/replay-words';
import { type LineReplayCheck, regressionsShown } from '@/lib/search';

type ReplayCheckThresholdProps = {
  replayCheck: LineReplayCheck | null;
};

const COMMAND = <code className="font-mono">spotlight replay check</code>;

export function ReplayCheckThreshold({
  replayCheck,
}: ReplayCheckThresholdProps) {
  return (
    <p
      data-slot="line-replay-check"
      className="flex min-w-0 items-start gap-1.5 text-muted-foreground text-xs leading-5"
    >
      <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {replayCheck ? (
        <span className="min-w-0">
          Pull requests fail {COMMAND} past{' '}
          <span className="text-foreground">
            {regressionsShown(replayCheck.mostRegressions)}
          </span>
          . Ceiling per check:{' '}
          <span className="text-foreground tabular-nums">
            {spentIn(replayCheck.ceiling, replayCheck.currency)}
          </span>{' '}
          · {minGainSentence(replayCheck.minGain)}
        </span>
      ) : (
        <span className="min-w-0">
          Line sets no replay_check. {COMMAND} won’t check its pull requests.
        </span>
      )}
    </p>
  );
}
