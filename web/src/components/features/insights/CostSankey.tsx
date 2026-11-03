import { useRef } from 'react';
import { Sankey, Tooltip } from 'recharts';
import { CostFlowTable } from '@/components/features/insights/CostFlowTable';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { useElementWidth } from '@/hooks/useElementWidth';
import { spentIn } from '@/lib/inbox';
import {
  COST_SANKEY_NOTE,
  flowLinkRows,
  type SankeyShown,
  sankeyLayout,
} from '@/lib/insights';
import { measured } from '@/lib/textFit';

export const COST_SANKEY_HEIGHT = 280;

const LABEL_FONT_SIZE = 11;
const ESTIMATED_CHAR_WIDTH = 6.2;
const RIGHT_SHARE = 0.4;

type NodeShape = {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: { name: string; depth: number; value: number };
};

const nodeFor =
  (currency: string, names: readonly string[]) =>
  ({ x, y, width, height, payload, index }: NodeShape) => {
    const first = payload.depth === 0;
    const middle = payload.depth === 1;

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="var(--chart-primary)"
          rx={1}
        />
        <text
          x={first ? x - 6 : x + width + 6}
          y={y + height / 2}
          dy="0.35em"
          textAnchor={first ? 'end' : 'start'}
          fontSize={11}
          stroke={middle ? 'var(--card)' : undefined}
          strokeWidth={middle ? 3 : undefined}
          paintOrder="stroke"
        >
          <tspan fill="var(--foreground)">{names[index] ?? payload.name}</tspan>
          <tspan fill="var(--muted-foreground)" dx={6}>
            {spentIn(payload.value, currency)}
          </tspan>
        </text>
      </g>
    );
  };

type Hovered = {
  name?: string;
  value?: number;
  payload?: {
    payload?: { source?: { name: string }; target?: { name: string } };
  };
};

const TipContent = ({
  active,
  payload,
  currency,
  placement,
}: {
  active?: boolean;
  payload?: Hovered[];
  currency: string;
  placement: TipPlacement;
}) => {
  const hovered = payload?.[0];

  if (!active || !hovered) {
    return null;
  }

  const flow = hovered.payload?.payload;

  return (
    <ChartTip placement={placement}>
      <p className="text-muted-foreground">
        {flow?.source && flow.target
          ? `${flow.source.name} → ${flow.target.name}`
          : hovered.name}
      </p>
      <p className="text-foreground tabular-nums">
        {spentIn(Number(hovered.value ?? 0), currency)}
      </p>
    </ChartTip>
  );
};

const labelMeasure = (): ((text: string) => number) => {
  const style = getComputedStyle(document.body);

  return (
    measured(`${LABEL_FONT_SIZE}px ${style.fontFamily}`) ??
    ((text) => text.length * ESTIMATED_CHAR_WIDTH)
  );
};

type CostSankeyProps = {
  shown: SankeyShown;
  currency: string;
};

function SankeyChart({ shown, currency }: CostSankeyProps) {
  const cursor = useCursorTooltip();
  const frame = useRef<HTMLElement>(null);
  const width = useElementWidth(frame);
  const { left, right, names } = sankeyLayout(
    shown,
    width,
    labelMeasure(),
    width * RIGHT_SHARE,
    currency,
  );

  return (
    <figure
      ref={frame}
      data-slot="cost-sankey"
      className="[&_*:focus:not(:focus-visible)]:outline-none"
      {...cursor.area}
    >
      {width > 0 && (
        <Sankey
          width={width}
          height={COST_SANKEY_HEIGHT}
          data={{ nodes: shown.nodes, links: shown.links }}
          nodeWidth={8}
          nodePadding={16}
          margin={{ top: 8, right, bottom: 8, left }}
          node={nodeFor(currency, names)}
          link={{ stroke: 'var(--chart-primary)', strokeOpacity: 0.12 }}
        >
          <Tooltip
            {...cursor.tooltip}
            content={
              <TipContent currency={currency} placement={cursor.placement} />
            }
          />
        </Sankey>
      )}
    </figure>
  );
}

export function CostSankey({ shown, currency }: CostSankeyProps) {
  if (shown.links.length === 0) {
    return null;
  }

  return (
    <InsightsCard
      title="Where the spend goes"
      description={COST_SANKEY_NOTE}
      table={<CostFlowTable rows={flowLinkRows(shown)} currency={currency} />}
    >
      <SankeyChart shown={shown} currency={currency} />
    </InsightsCard>
  );
}
