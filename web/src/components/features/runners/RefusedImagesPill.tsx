import { COMPACT_PILL } from '@/components/features/runners/columns';
import { Pill } from '@/components/shared/Pill';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { HostImageResponseDto } from '@/lib/api';

export function RefusedImagesPill({
  refused,
}: {
  refused: readonly HostImageResponseDto[];
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the refusals are only told in the tooltip
            tabIndex={0}
            className="flex shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          />
        }
      >
        <Pill
          className={`${COMPACT_PILL} border-destructive/30 text-destructive`}
        >
          {refused.length} refused
        </Pill>
      </TooltipTrigger>
      <TooltipContent className="flex max-w-80 flex-col gap-1">
        {refused.map((image) => (
          <span key={image.image} className="break-words">
            <span className="font-medium">{image.image}</span>
            <br />
            {image.refused}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
