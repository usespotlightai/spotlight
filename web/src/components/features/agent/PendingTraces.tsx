import { X } from 'lucide-react';
import { SharedTraceChip } from '@/components/features/agent/SharedTraceChip';
import { Button } from '@/components/ui/button';
import type { SharedTrace } from '@/lib/chat';
import { cn } from '@/lib/utils';

type PendingTracesProps = {
  traces: readonly SharedTrace[];
  onRemove: (taskId: string) => void;
  className?: string;
};

export function PendingTraces({
  traces,
  onRemove,
  className,
}: PendingTracesProps) {
  if (traces.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label="Traces to share"
      className={cn('flex flex-wrap gap-2', className)}
    >
      {traces.map((trace) => (
        <li key={trace.taskId}>
          <SharedTraceChip
            trace={trace}
            className="w-48 max-w-none"
            trailing={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="-mr-1 rounded-full text-muted-foreground"
                onClick={() => onRemove(trace.taskId)}
                aria-label={`Remove the trace of ${trace.title}`}
              >
                <X />
              </Button>
            }
          />
        </li>
      ))}
    </ul>
  );
}
