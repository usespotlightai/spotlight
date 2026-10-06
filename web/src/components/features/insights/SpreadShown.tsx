import type { ReactNode } from 'react';
import { InfoNote } from '@/components/features/insights/InfoNote';

type SpreadShownProps = {
  tail: string | null;
  children: ReactNode;
};

export function SpreadShown({ tail, children }: SpreadShownProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      {tail && <InfoNote note={tail} />}
    </span>
  );
}
