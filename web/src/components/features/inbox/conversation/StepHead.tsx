import { ChevronRight } from 'lucide-react';
import type { ShownStep } from '@/lib/journal-step';
import { cn } from '@/lib/utils';

type StepHeadProps = {
  shown: ShownStep;
  running: boolean;
  failed: boolean;
  open: boolean;
  expandable: boolean;
};

export function StepHead({
  shown,
  running,
  failed,
  open,
  expandable,
}: StepHeadProps) {
  return (
    <>
      <span className={cn('min-w-0 flex-1 truncate', running && 'step-shine')}>
        {running ? (
          shown.label
        ) : (
          <>
            <span
              className={cn(
                'font-medium',
                failed ? 'text-destructive' : 'text-foreground',
              )}
            >
              {shown.keyword}
            </span>
            {shown.detail && (
              <span
                className={
                  failed ? 'text-destructive/70' : 'text-muted-foreground'
                }
              >
                {' '}
                {shown.detail}
              </span>
            )}
          </>
        )}
      </span>

      <span className="flex size-4 shrink-0 items-center justify-center">
        <ChevronRight
          className={cn(
            'size-3 text-muted-foreground opacity-70 transition-transform duration-200',
            open && 'rotate-90',
            !expandable && 'invisible',
          )}
        />
      </span>
    </>
  );
}
