import type { LucideIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { DisabledReasonTooltip } from '@/components/shared/DisabledReasonTooltip';
import { Button } from '@/components/ui/button';

type DialogButtonProps = {
  label: string;
  icon?: LucideIcon;
  variant?: 'default' | 'outline';
  disabledBecause: ReactNode;
  waiting?: boolean;
  dialog: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
};

export function DialogButton({
  label,
  icon: Icon,
  variant = 'default',
  disabledBecause,
  waiting = false,
  dialog,
}: DialogButtonProps) {
  const [open, setOpen] = useState(false);
  const disabled = disabledBecause !== null && disabledBecause !== undefined;

  return (
    <>
      <DisabledReasonTooltip reason={disabled ? disabledBecause : null}>
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
            disabled={disabled || waiting}
            aria-describedby={describedBy}
            onClick={() => setOpen(true)}
          >
            {Icon && <Icon aria-hidden />}
            {label}
          </Button>
        )}
      </DisabledReasonTooltip>

      {dialog(open, setOpen)}
    </>
  );
}
