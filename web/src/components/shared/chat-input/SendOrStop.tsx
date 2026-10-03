import { ArrowUp, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

type SendOrStopProps = {
  onStop: (() => void) | null;
  unsendable: boolean;
};

export function SendOrStop({ onStop, unsendable }: SendOrStopProps) {
  if (onStop) {
    return (
      <Button
        type="button"
        size="icon-sm"
        className="rounded-full"
        onClick={onStop}
        aria-label="Stop"
      >
        <Square className="size-3 fill-current" />
      </Button>
    );
  }

  return (
    <Button
      type="submit"
      size="icon-sm"
      className="rounded-full"
      disabled={unsendable}
      aria-label="Send"
    >
      <ArrowUp />
    </Button>
  );
}
