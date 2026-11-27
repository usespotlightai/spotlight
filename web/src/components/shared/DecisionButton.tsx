import { type ComponentProps, use, type ReactElement } from 'react';

import { PillButton } from '@/components/shared/PillButton';
import { DockedContext } from '@/lib/decision-tray';
import { cn } from '@/lib/utils';

export function DecisionButton({
  className,
  variant = 'outline',
  ...props
}: ComponentProps<typeof PillButton>): ReactElement {
  const docked = use(DockedContext) !== null;
  const quiet = docked && variant === 'outline';

  return (
    <PillButton
      variant={quiet ? 'ghost' : variant}
      className={cn(
        'h-7 min-w-18 px-3 text-sm pointer-coarse:h-9',
        docked ? 'rounded-full' : 'rounded-md shadow-xs',
        quiet && 'text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}
