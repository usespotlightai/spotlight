import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import { CostFlowTable } from '@/components/features/insights/CostFlowTable';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
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
        fill="var(--primary)"
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

type CostSankeyProps = {
  shown: SankeyShown;
  currency: string;
};

export function CostSankey({ shown, currency }: CostSankeyProps) {
  if (shown.links.length === 0) {
    return null;
  }

  return (
    <InsightsCard
      title="Where the spend goes"
      description="From model, to station, to repository. A run on several repositories splits its cost evenly among them."
      table={<CostFlowTable rows={flowLinkRows(shown)} currency={currency} />}
    >
      <figure
        data-slot="cost-sankey"
        className="[&_*:focus:not(:focus-visible)]:outline-none"
      >
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <Sankey
            data={{ nodes: shown.nodes, links: shown.links }}
            nodeWidth={8}
            nodePadding={16}
            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
            node={Node}
            link={{ stroke: 'var(--primary)', strokeOpacity: 0.18 }}
          >
            <Tooltip
              isAnimationActive={false}
              formatter={(value) => spentIn(Number(value), currency)}
            />
          </Sankey>
        </ResponsiveContainer>
      </figure>
    </InsightsCard>
  );
}
