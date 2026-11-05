import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type EmptyFrameProps = {
  children: ReactNode;
  className?: string;
};

export function EmptyFrame({ children, className }: EmptyFrameProps) {
  return (
    <div className={cn('flex justify-center py-10', className)}>{children}</div>
  );
}
