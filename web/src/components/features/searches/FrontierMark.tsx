import { Zap } from 'lucide-react';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { ON_THE_FRONTIER, ON_THE_FRONTIER_NOTE } from '@/lib/search-words';

export function FrontierMark() {
  return (
    <WithTooltip tooltip={ON_THE_FRONTIER_NOTE} named={ON_THE_FRONTIER}>
      <span
        role="img"
        aria-label={ON_THE_FRONTIER}
        data-slot="on-the-frontier"
        className="relative z-10 inline-flex shrink-0"
      >
        <Zap aria-hidden className="size-3.5 text-primary" />
      </span>
    </WithTooltip>
  );
}
