import type { ReactNode } from 'react';

import { WithTooltip } from '@/components/shared/WithTooltip';
import { nonEmpty } from '@/lib/non-empty';

type SpreadShownProps = {
  tail: string | null;
  children: ReactNode;
};

export function SpreadShown({ tail, children }: SpreadShownProps): ReactNode {
  return nonEmpty(tail) ? (
    <WithTooltip tooltip={tail}>
      <span className="cursor-default">{children}</span>
    </WithTooltip>
  ) : (
    children
  );
}
