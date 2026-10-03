import type { LucideIcon } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { Button } from '@/components/ui/button';

type DialogButtonProps = {
  label: string;
  icon: LucideIcon;
  variant?: 'default' | 'outline';
  refusedBecause: ReactNode;
  waiting?: boolean;
  refusalId?: string;
  refusalShown?: boolean;
  dialog: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
};

export function DialogButton({
  label,
  icon: Icon,
  variant = 'default',
  refusedBecause,
  waiting = false,
  refusalId,
  refusalShown = true,
  dialog,
}: DialogButtonProps) {
  const [open, setOpen] = useState(false);
  const ownRefusalId = useId();
  const describedBy = refusalId ?? ownRefusalId;
  const refused = refusedBecause !== null && refusedBecause !== undefined;

  return (
    <div className="flex flex-col items-center gap-1">
      <Button
        type="button"
        variant={variant}
        size="sm"
        className="rounded-full"
        disabled={refused || waiting}
        aria-describedby={refused ? describedBy : undefined}
        onClick={() => setOpen(true)}
      >
        <Icon aria-hidden />
        {label}
      </Button>
      {refused && refusalShown && (
        <div id={describedBy} className="text-muted-foreground text-xs">
          {refusedBecause}
        </div>
      )}

      {dialog(open, setOpen)}
    </div>
  );
}
