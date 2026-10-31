import { useRef } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useOverflows } from '@/hooks/useOverflows';
import { cn } from '@/lib/utils';

type OneLineProps = {
  text: string;
  className?: string;
};

export function OneLine({ text, className }: OneLineProps) {
  const line = useRef<HTMLSpanElement>(null);
  const overflows = useOverflows(line, true, 'x', text);

  return (
    <Tooltip disabled={!overflows}>
      <TooltipTrigger
        render={
          <span
            ref={line}
            data-slot="one-line"
            className={cn('block truncate', className)}
          />
        }
      >
        {text}
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">{text}</TooltipContent>
    </Tooltip>
  );
}
