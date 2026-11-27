import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CouldNotLoadProps = {
  what: string;
  retrying: boolean;
  onRetry: () => void;
  className?: string;
};

export function CouldNotLoad({
  what,
  retrying,
  onRetry,
  className,
}: CouldNotLoadProps) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-2', className)}
    >
      <p className="text-muted-foreground text-sm">
        {what} could not be loaded.
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full bg-card"
        onClick={onRetry}
        disabled={retrying}
      >
        Try again
      </Button>
    </div>
  );
}
