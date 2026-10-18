import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatType, type PullRequestType } from '@/lib/insights-pull-requests';
import {
  bottleneckColor,
  TYPE_COLORS,
  type TypeShare,
} from '@/lib/pipeline-flow';
import { cn } from '@/lib/utils';

type PipelineFlowLegendProps = {
  shares: readonly TypeShare[];
  focus: PullRequestType | null;
  onFocus: (type: PullRequestType | null) => void;
};

export function PipelineFlowLegend({
  shares,
  focus,
  onFocus,
}: PipelineFlowLegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-border border-t pt-2 text-muted-foreground text-xs">
      <span className="flex items-center gap-1.5">
        flows freely
        <span
          aria-hidden
          className="h-1 w-14 rounded-full"
          style={{
            background: `linear-gradient(to right, ${bottleneckColor(0)}, ${bottleneckColor(0.5)}, ${bottleneckColor(1)})`,
          }}
        />
        <span className="text-destructive">bottleneck</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="How the bottleneck is measured"
                className="flex outline-none"
              />
            }
          >
            <Info aria-hidden className="size-3" />
          </TooltipTrigger>
          <TooltipContent className="max-w-72 text-xs">
            Colour: time in the stage compared with the slowest stage. Where
            pull requests wait, the dots crowd and the band narrows.
          </TooltipContent>
        </Tooltip>
      </span>

      <fieldset
        aria-label="Pull request type"
        className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 p-0"
      >
        {shares.map(({ type }) => (
          <button
            key={type}
            type="button"
            aria-pressed={focus === type}
            onClick={() => onFocus(focus === type ? null : type)}
            className={cn(
              'flex items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
              focus === type && 'text-foreground',
              focus && focus !== type && 'opacity-50',
            )}
          >
            <span
              aria-hidden
              className="size-2 rounded-sm"
              style={{ background: TYPE_COLORS[type] }}
            />
            {formatType(type)}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
