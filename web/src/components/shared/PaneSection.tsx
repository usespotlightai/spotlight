import { type ReactNode, useId } from 'react';
import { cn } from '@/lib/utils';

type PaneSectionProps = {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function PaneSection({
  title,
  action,
  className,
  children,
}: PaneSectionProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={cn('group/section flex flex-col gap-2', className)}
    >
      <div className="flex h-5 items-center justify-between gap-2">
        <h3 id={titleId} className="font-medium text-muted-foreground text-xs">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
