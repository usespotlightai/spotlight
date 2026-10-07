import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { lastedOrNone } from '@/lib/insights';
import {
  type FlowStage,
  partShown,
  STATION_PARTS,
} from '@/lib/insights-shipping';
import { cn } from '@/lib/utils';

export function PipelineStageLabel({
  stage,
  x,
  top,
  worst,
}: {
  stage: FlowStage;
  x: number;
  top: number;
  worst: boolean;
}) {
  const parts = stage.parts;
  const text = (
    <span className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          'max-w-32 truncate text-[0.7rem]',
          worst ? 'text-destructive' : 'text-foreground',
        )}
      >
        {stage.label}
      </span>
      <span className="font-mono text-[0.7rem] text-muted-foreground">
        {lastedOrNone(stage.ms)}
      </span>
    </span>
  );

  return (
    <div className="-translate-x-1/2 absolute" style={{ left: x, top }}>
      {parts ? (
        <Tooltip>
          <TooltipTrigger
            render={<button type="button" className="outline-none" />}
          >
            {text}
          </TooltipTrigger>
          <TooltipContent className="flex flex-col gap-0.5 text-xs">
            <span className="text-foreground">{stage.label}</span>
            {STATION_PARTS.map((part) => (
              <span key={part} className="text-muted-foreground">
                {partShown(part)}{' '}
                <span className="font-mono">{lastedOrNone(parts[part])}</span>
              </span>
            ))}
          </TooltipContent>
        </Tooltip>
      ) : (
        text
      )}
    </div>
  );
}
