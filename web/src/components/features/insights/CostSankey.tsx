import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import { CostFlowTable } from '@/components/features/insights/CostFlowTable';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { spentIn } from '@/lib/inbox';
import {
  COST_SANKEY_NOTE,
  flowLinkRows,
  type SankeyShown,
} from '@/lib/insights';

export const COST_SANKEY_HEIGHT = 280;

const LABEL_ROOM = 140;

type NodeShape = {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: { name: string; depth: number; value: number };
};

const nodeFor =
  (currency: string) =>
  ({ x, y, width, height, payload }: NodeShape) => {
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
          <tspan fill="var(--foreground)">{payload.name}</tspan>
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

type CostSankeyProps = {
  shown: SankeyShown;
  currency: string;
};

export function CostSankey({ shown, currency }: CostSankeyProps) {
  const cursor = useCursorTooltip();

  if (shown.links.length === 0) {
    return null;
  }

  return (
    <InsightsCard
      title="Where the spend goes"
      description={COST_SANKEY_NOTE}
      table={<CostFlowTable rows={flowLinkRows(shown)} currency={currency} />}
    >
      <figure
        data-slot="cost-sankey"
        className="[&_*:focus:not(:focus-visible)]:outline-none"
        {...cursor.area}
      >
        <ResponsiveContainer width="100%" height={COST_SANKEY_HEIGHT}>
          <Sankey
            data={{ nodes: shown.nodes, links: shown.links }}
            nodeWidth={8}
            nodePadding={16}
            margin={{ top: 8, right: LABEL_ROOM, bottom: 8, left: LABEL_ROOM }}
            node={nodeFor(currency)}
            link={{ stroke: 'var(--chart-primary)', strokeOpacity: 0.12 }}
          >
            <Tooltip
              {...cursor.tooltip}
              content={
                <TipContent currency={currency} placement={cursor.placement} />
              }
            />
          </Sankey>
        </ResponsiveContainer>
      </figure>
    </InsightsCard>
  );
}
