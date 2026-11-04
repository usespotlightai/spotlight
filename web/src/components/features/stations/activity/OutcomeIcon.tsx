import {
  CircleArrowLeft,
  CircleCheck,
  CircleSlash,
  CircleX,
} from 'lucide-react';
import { TONE_INK } from '@/components/features/stations/activity/outcome-tones';
import type { OutcomeTone } from '@/lib/station-insights';
import { cn } from '@/lib/utils';

const ICONS = {
  done: CircleCheck,
  sentBack: CircleArrowLeft,
  failed: CircleX,
  quiet: CircleSlash,
} as const;

export function OutcomeIcon({ tone }: { tone: OutcomeTone }) {
  const Icon = ICONS[tone];

  return (
    <Icon
      aria-hidden
      data-tone={tone}
      className={cn('size-3.5 shrink-0', TONE_INK[tone])}
    />
  );
}
