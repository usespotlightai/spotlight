import type { ReactNode } from 'react';
import { Noted } from '@/components/shared/Noted';

type SpreadShownProps = {
  tail: string | null;
  children: ReactNode;
};

export function SpreadShown({ tail, children }: SpreadShownProps) {
  return tail ? (
    <Noted note={tail}>
      <span className="cursor-default">{children}</span>
    </Noted>
  ) : (
    children
  );
}
