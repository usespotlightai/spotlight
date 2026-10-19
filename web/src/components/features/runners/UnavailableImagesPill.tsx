import type { ReactNode } from 'react';
import { COMPACT_PILL } from '@/components/features/runners/columns';
import { Pill } from '@/components/shared/Pill';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { HostImageResponseDto } from '@/lib/api';
import { cn } from '@/lib/utils';

export function UnavailableImagesPill({
  unavailable,
  children,
  className,
}: {
  unavailable: readonly HostImageResponseDto[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className={cn(
              'flex cursor-default rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
              className,
            )}
          />
        }
      >
        <Pill
          className={`${COMPACT_PILL} min-w-0 shrink border-destructive/30 text-destructive`}
        >
          <span className="truncate">{children}</span>
        </Pill>
      </TooltipTrigger>
      <TooltipContent className="flex max-w-80 flex-col gap-1">
        {unavailable.map((image) => (
          <span key={image.image} className="break-words">
            <span className="font-medium">{image.image}</span>
            <br />
            {image.unavailableReason}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
