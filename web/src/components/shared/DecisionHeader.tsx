import type { ReactNode } from 'react';

type DecisionHeaderProps = {
  title: ReactNode;
  trailing?: ReactNode;
};

export function DecisionHeader({ title, trailing }: DecisionHeaderProps) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-2">
      {title}
      {trailing}
    </div>
  );
}
