import { WithTooltip } from '@/components/shared/WithTooltip';
import { formatDurationOrNone } from '@/lib/insights';
import {
  type FlowStage,
  formatPart,
  STATION_STAGES,
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
          'max-w-32 truncate text-xs',
          worst ? 'text-outcome-failed' : 'text-foreground',
        )}
      >
        {stage.label}
      </span>
      <span className="tabular-nums text-xs text-muted-foreground">
        {formatDurationOrNone(stage.ms)}
      </span>
    </span>
  );

  return (
    <div className="-translate-x-1/2 absolute" style={{ left: x, top }}>
      {parts ? (
        <WithTooltip
          tooltip={{
            title: stage.label,
            rows: STATION_STAGES.map((part): [string, string] => [
              formatPart(part),
              formatDurationOrNone(parts[part]),
            ]),
          }}
        >
          <button type="button" className="outline-none">
            {text}
          </button>
        </WithTooltip>
      ) : (
        text
      )}
    </div>
  );
}
