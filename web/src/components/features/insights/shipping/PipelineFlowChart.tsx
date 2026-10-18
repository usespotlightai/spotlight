import { useId, useMemo, useRef } from 'react';
import { PipelineStageLabel } from '@/components/features/insights/shipping/PipelineStageLabel';
import { useElementWidth } from '@/hooks/useElementWidth';
import { usePipelineParticles } from '@/hooks/usePipelineParticles';
import { formatDurationOrNone } from '@/lib/insights';
import type { PullRequestType } from '@/lib/insights-pull-requests';
import { type FlowStage, formatPart } from '@/lib/insights-shipping';
import {
  bandEdge,
  bottleneckColor,
  geometryOf,
  type TypeShare,
} from '@/lib/pipeline-flow';

const HEIGHT = 216;
const LABELS = 52;
const MIDDLE = LABELS + 62;
const MARKS_END = HEIGHT - 34;
const BRACKET_EXTENT = 24;

type PipelineFlowChartProps = {
  stages: readonly FlowStage[];
  shares: readonly TypeShare[];
  focus: PullRequestType | null;
  playing: boolean;
  label: string;
};

export function PipelineFlowChart({
  stages,
  shares,
  focus,
  playing,
  label,
}: PipelineFlowChartProps) {
  const gradientId = useId();
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = useElementWidth(frame);
  const geometry = useMemo(() => geometryOf(stages, width), [stages, width]);
  const worstAt = stages.findIndex((stage) => stage.worst);
  const worst = stages[worstAt];
  const stations = stages.filter((stage) => stage.station);

  usePipelineParticles({
    canvas,
    geometry,
    middle: MIDDLE,
    height: HEIGHT,
    shares,
    focus,
    playing,
  });

  const worstPart = worst?.longestPart ?? null;

  return (
    <div className="overflow-x-auto">
      <div
        ref={frame}
        role="img"
        aria-label={label}
        className="relative min-w-[40rem]"
        style={{ height: HEIGHT }}
      >
        {width > 0 && (
          <svg
            aria-hidden
            className="absolute inset-0"
            width={width}
            height={HEIGHT}
          >
            <defs>
              <linearGradient
                id={gradientId}
                gradientUnits="userSpaceOnUse"
                x1={0}
                x2={width}
              >
                {stages.map((stage, at) => (
                  <stop
                    key={stage.id}
                    offset={geometry.centers[at] / width}
                    style={{
                      stopColor: bottleneckColor(stage.bottleneckRatio),
                    }}
                  />
                ))}
              </linearGradient>
            </defs>

            {stations.length > 0 && (
              <g className="text-chart-grid">
                <line
                  x1={geometry.centers[0] - BRACKET_EXTENT}
                  x2={geometry.centers[stations.length - 1] + BRACKET_EXTENT}
                  y1={8}
                  y2={8}
                  stroke="currentColor"
                />
              </g>
            )}

            {stages.map((stage, at) => (
              <line
                key={stage.id}
                x1={geometry.centers[at]}
                x2={geometry.centers[at]}
                y1={LABELS}
                y2={MARKS_END}
                strokeDasharray="2 3"
                stroke={
                  at === worstAt ? 'var(--destructive)' : 'var(--chart-grid)'
                }
                strokeOpacity={at === worstAt ? 0.8 : 1}
              />
            ))}

            {[1, -1].map((side) => (
              <path
                key={side}
                d={bandEdge(geometry, MIDDLE, side as 1 | -1)}
                fill="none"
                stroke={`url(#${CSS.escape(gradientId)})`}
                strokeWidth={1.25}
              />
            ))}
          </svg>
        )}

        <canvas
          ref={canvas}
          aria-hidden
          className="absolute inset-0"
          style={{ width, height: HEIGHT }}
        />

        {stations.length > 0 && width > 0 && (
          <span
            className="absolute top-0 bg-card pr-1.5 text-[0.7rem] text-muted-foreground"
            style={{ left: geometry.centers[0] - BRACKET_EXTENT }}
          >
            Coding, by station
          </span>
        )}

        {stages.map((stage, at) => (
          <PipelineStageLabel
            key={stage.id}
            stage={stage}
            x={geometry.centers[at] ?? 0}
            top={LABELS - 34}
            worst={at === worstAt}
          />
        ))}

        {worst && worst.ms !== null && (
          <span
            className="-translate-x-1/2 absolute flex items-center gap-1.5 whitespace-nowrap rounded-full border border-destructive/50 bg-card px-2 py-0.5 text-[0.7rem] text-destructive"
            style={{ left: geometry.centers[worstAt], top: MARKS_END - 2 }}
          >
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-destructive"
            />
            Worst bottleneck
            <span className="text-destructive/50">|</span>
            <span className="font-mono">{formatDurationOrNone(worst.ms)}</span>
            {worstPart && (
              <span className="text-destructive/80">
                mostly {formatPart(worstPart)}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
