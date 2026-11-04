import type { OutcomeTone } from '@/lib/station-insights';

export const TONE_FILL: Record<OutcomeTone, string> = {
  done: 'bg-outcome-done',
  sentBack: 'bg-outcome-sent-back',
  failed: 'bg-outcome-failed',
  quiet: 'bg-muted-foreground/20',
};

export const TONE_INK: Record<OutcomeTone, string> = {
  done: 'text-outcome-done',
  sentBack: 'text-outcome-sent-back',
  failed: 'text-outcome-failed',
  quiet: 'text-muted-foreground',
};
