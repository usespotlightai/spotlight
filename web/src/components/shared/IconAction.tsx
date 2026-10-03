import type { ReactNode } from 'react';
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
  onClick: () => void;
  children: ReactNode;
};

export function IconAction({
  label,
  tip,
  pressed,
  onClick,
  children,
}: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={pressed}
            onClick={onClick}
            className={cn(
              'flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5',
              pressed && 'bg-accent text-foreground',
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
