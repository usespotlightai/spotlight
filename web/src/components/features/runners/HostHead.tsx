import { HOST_COLUMNS } from '@/components/features/runners/columns';
import { cn } from '@/lib/utils';

export function HostHead() {
  return (
    <div
      className={cn(
        'grid h-8 items-center gap-3 px-3 text-muted-foreground text-xs',
        HOST_COLUMNS,
      )}
    >
      <span className="truncate">Name</span>
      <span className="truncate">Serves</span>
      <span className="truncate">Status</span>
      <span className="truncate">Images</span>
      <span className="truncate">Harnesses</span>
      <span className="truncate">Release</span>
      <span className="truncate text-right">Last activity</span>
    </div>
  );
}
