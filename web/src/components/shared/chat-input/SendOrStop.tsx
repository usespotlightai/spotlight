import { ArrowUp, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type SendOrStopProps = {
  onStop: (() => void) | null;
  unsendable: boolean;
};

export function SendOrStop({ onStop, unsendable }: SendOrStopProps) {
  if (onStop) {
    return (
      <Tooltip>
        <TooltipTrigger
          iconOnly
          render={
            <Button
              type="button"
              size="icon-sm"
              className="rounded-full pointer-coarse:size-9"
              onClick={onStop}
              aria-label="Stop"
            />
          }
        >
          <Square className="size-3 fill-current" />
        </TooltipTrigger>
        <TooltipContent>Stop the agent</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        iconOnly
        render={
          <Button
            type="submit"
            size="icon-sm"
            className="rounded-full pointer-coarse:size-9"
            disabled={unsendable}
            aria-label="Send"
          />
        }
      >
        <ArrowUp />
      </TooltipTrigger>
      <TooltipContent>Send</TooltipContent>
    </Tooltip>
  );
}
