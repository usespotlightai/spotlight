import { FileIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AttachmentChipProps = {
  name: string;
  detail: ReactNode;
  lead?: ReactNode;
  trailing?: ReactNode;
  className?: string;
};

export function AttachmentChip({
  name,
  detail,
  lead,
  trailing,
  className,
}: AttachmentChipProps) {
  return (
    <span
      className={cn(
        'flex h-10 max-w-60 items-center gap-2 rounded-lg border border-border bg-card pr-2 pl-1.5 text-xs transition-colors',
        className,
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
        {lead ?? <FileIcon className="size-4" aria-hidden />}
      </span>

      <span className="flex min-w-0 flex-1 flex-col leading-4">
        <span className="truncate font-medium text-foreground">{name}</span>
        <span className="truncate text-muted-foreground">{detail}</span>
      </span>

      {trailing}
    </span>
  );
}
