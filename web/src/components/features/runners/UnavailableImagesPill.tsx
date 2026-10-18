import { COMPACT_PILL } from '@/components/features/runners/columns';
import { Pill } from '@/components/shared/Pill';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { HostImageResponseDto } from '@/lib/api';

export function UnavailableImagesPill({
  unavailable,
}: {
  unavailable: readonly HostImageResponseDto[];
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="flex shrink-0 cursor-default rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          />
        }
      >
        <Pill
          className={`${COMPACT_PILL} border-destructive/30 text-destructive`}
        >
          {unavailable.length} unavailable
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
