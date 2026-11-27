import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactElement } from 'react';

import { IconAction } from '@/components/shared/IconAction';

type DecisionPagerProps = {
  place: number;
  count: number;
  onStep: (by: 1 | -1) => void;
};

export function DecisionPager({
  place,
  count,
  onStep,
}: DecisionPagerProps): ReactElement {
  return (
    <span className="flex items-center text-muted-foreground text-xs tabular-nums">
      <IconAction
        label="Previous"
        disabled={place === 0}
        onClick={() => onStep(-1)}
      >
        <ChevronLeft />
      </IconAction>
      {`${place + 1} of ${count}`}
      <IconAction
        label="Next"
        disabled={place === count - 1}
        onClick={() => onStep(1)}
      >
        <ChevronRight />
      </IconAction>
    </span>
  );
}
