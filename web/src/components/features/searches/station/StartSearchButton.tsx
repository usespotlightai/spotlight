import { useState } from 'react';
import { StartSearchDialog } from '@/components/features/searches/station/StartSearchDialog';
import { Button } from '@/components/ui/button';
import type { ReplayedStation, ReplaySet } from '@/lib/replay';
import { cn } from '@/lib/utils';

type StartSearchButtonProps = {
  at: ReplayedStation;
  sets: readonly ReplaySet[];
  refusedBecause: string | null;
  className?: string;
};

export function StartSearchButton({
  at,
  sets,
  refusedBecause,
  className,
}: StartSearchButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full bg-card shadow-none"
        disabled={refusedBecause !== null}
        onClick={() => setOpen(true)}
      >
        Start a search
      </Button>
      {refusedBecause && (
        <span className="text-muted-foreground text-xs">{refusedBecause}</span>
      )}

      <StartSearchDialog
        at={at}
        sets={sets}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
