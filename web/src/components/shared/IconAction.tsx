import type { ReactNode } from 'react';

import { ICON_ACTION } from '@/components/shared/icon-action';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type IconActionProps = {
  label: string;
  tip?: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  focusNext?: boolean;
  onClick: () => void;
  children: ReactNode;
};

export function IconAction({
  label,
  tip,
  pressed,
  disabled,
  focusNext,
  onClick,
  children,
}: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        iconOnly
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            data-focus-next={focusNext === true || undefined}
            onClick={onClick}
            className={cn(
              ICON_ACTION,
              'disabled:pointer-events-none disabled:opacity-50',
              pressed === true && 'bg-accent text-foreground',
            )}
          >
            {children}
          </button>
        }
      />
      <TooltipContent side="bottom" align="center">
        {tip ?? label}
      </TooltipContent>
    </Tooltip>
  );
}
