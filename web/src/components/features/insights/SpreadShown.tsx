import type { ReactNode } from 'react';
import { WithTooltip } from '@/components/shared/WithTooltip';

type SpreadShownProps = {
  tail: string | null;
  children: ReactNode;
};

export function SpreadShown({ tail, children }: SpreadShownProps) {
  return tail ? (
    <WithTooltip tooltip={tail}>
      <span className="cursor-default">{children}</span>
    </WithTooltip>
  ) : (
    children
  );
}
