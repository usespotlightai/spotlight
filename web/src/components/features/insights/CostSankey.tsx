import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import { CostFlowTable } from '@/components/features/insights/CostFlowTable';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { ChartTip } from '@/components/shared/chart/ChartTip';
import { type TipPlacement, useCursorTooltip } from '@/hooks/useCursorTooltip';
import { spentIn } from '@/lib/inbox';
import { flowLinkRows, type SankeyShown } from '@/lib/insights';

const HEIGHT = 280;

type NodeShape = {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: { name: string; depth: number };
};

const Node = ({ x, y, width, height, payload }: NodeShape) => {
  const last = payload.depth === 2;

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
        x={last ? x - 6 : x + width + 6}
        y={y + height / 2}
        dy="0.35em"
        textAnchor={last ? 'end' : 'start'}
        fill="var(--foreground)"
        fontSize={11}
      >
        {payload.name}
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

const Said = ({
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
      description="Spend from model to station to repository. A run on several repositories splits its cost evenly."
      table={<CostFlowTable rows={flowLinkRows(shown)} currency={currency} />}
    >
      <figure
        data-slot="cost-sankey"
        className="[&_*:focus:not(:focus-visible)]:outline-none"
        {...cursor.area}
      >
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <Sankey
            data={{ nodes: shown.nodes, links: shown.links }}
            nodeWidth={8}
            nodePadding={16}
            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
            node={Node}
            link={{ stroke: 'var(--chart-primary)', strokeOpacity: 0.18 }}
          >
            <Tooltip
              {...cursor.tooltip}
              content={
                <Said currency={currency} placement={cursor.placement} />
              }
            />
          </Sankey>
        </ResponsiveContainer>
      </figure>
    </InsightsCard>
  );
}
