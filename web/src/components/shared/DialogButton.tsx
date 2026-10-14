import type { LucideIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { RefusalTooltip } from '@/components/shared/RefusalTooltip';
import { Button } from '@/components/ui/button';

type DialogButtonProps = {
  label: string;
  icon?: LucideIcon;
  variant?: 'default' | 'outline';
  refusedBecause: ReactNode;
  waiting?: boolean;
  dialog: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
};

export function DialogButton({
  label,
  icon: Icon,
  variant = 'default',
  refusedBecause,
  waiting = false,
  dialog,
}: DialogButtonProps) {
  const [open, setOpen] = useState(false);
  const refused = refusedBecause !== null && refusedBecause !== undefined;

  return (
    <>
      <RefusalTooltip reason={refused ? refusedBecause : null}>
        {(describedBy) => (
          <Button
            type="button"
            variant={variant}
            size="sm"
            className={
              variant === 'outline'
                ? 'rounded-full bg-card shadow-none'
                : 'rounded-full'
            }
            disabled={refused || waiting}
            aria-describedby={describedBy}
            onClick={() => setOpen(true)}
          >
            {Icon && <Icon aria-hidden />}
            {label}
          </Button>
        )}
      </RefusalTooltip>

      {dialog(open, setOpen)}
    </>
  );
}
