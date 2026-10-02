import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ReplaysHeadingProps = {
  title: string;
  id?: string;
  level?: 'h2' | 'h3';
  action?: ReactNode;
};

export function ReplaysHeading({
  title,
  id,
  level: Heading = 'h3',
  action,
}: ReplaysHeadingProps) {
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
      <Heading
        id={id}
        className={cn(
          'scroll-mt-4 font-medium text-foreground',
          Heading === 'h2' ? 'text-sm' : 'text-xs',
        )}
      >
        {title}
      </Heading>
      {action}
    </div>
  );
}
