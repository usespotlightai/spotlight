import {
  formatEnding,
  type OutcomeTone,
  outcomeTone,
  type StationRunOutcome,
} from '@/lib/station-insights';

export const TONE_FILL: Record<OutcomeTone, string> = {
  done: 'bg-outcome-done',
  sentBack: 'bg-outcome-sent-back',
  failed: 'bg-outcome-failed',
  quiet: 'bg-muted-foreground/20 dark:bg-muted-foreground/70',
};

export const TONE_INK: Record<OutcomeTone, string> = {
  done: 'text-outcome-done',
  sentBack: 'text-outcome-sent-back',
  failed: 'text-outcome-failed',
  quiet: 'text-muted-foreground',
};

export const toneLabel = (run: StationRunOutcome): string => {
  const tone = outcomeTone(run);

  return tone === 'sentBack' ? 'Sent back' : formatEnding(run.ending);
};
