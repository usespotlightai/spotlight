import { Waypoints } from 'lucide-react';
import { useRef, useState } from 'react';
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

const LABEL_FONT_SIZE = 12;
const ESTIMATED_CHAR_WIDTH = 6.8;

const NARROW = 640;
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
          fontSize={LABEL_FONT_SIZE}
          stroke={middle ? 'var(--surface)' : undefined}
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

type LinkShape = {
  sourceX: number;
  targetX: number;
  sourceY: number;
  targetY: number;
  sourceControlX: number;
  targetControlX: number;
  linkWidth: number;
  index: number;
};

const linkFor =
  (hovered: number | null) =>
  ({
    sourceX,
    targetX,
    sourceY,
    targetY,
    sourceControlX,
    targetControlX,
    linkWidth,
    index,
  }: LinkShape) => (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke="var(--chart-primary)"
      strokeWidth={linkWidth}
      strokeOpacity={hovered === null ? 0.12 : hovered === index ? 0.3 : 0.06}
    />
  );

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
    <ChartTip
      placement={placement}
      note={{
        title:
          flow?.source && flow.target
            ? `${flow.source.name} → ${flow.target.name}`
            : hovered.name,
        rows: [['Spend', spentIn(Number(hovered.value ?? 0), currency)]],
      }}
    />
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

function SankeyChart({
  shown,
  currency,
  width,
}: CostSankeyProps & { width: number }) {
  const cursor = useCursorTooltip();
  const [hovered, setHovered] = useState<number | null>(null);
  const { left, right, names } = sankeyLayout(
    shown,
    width,
    labelMeasure(),
    width * RIGHT_SHARE,
    currency,
  );

  return (
    <figure
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
          sort={false}
          iterations={0}
          margin={{ top: 8, right, bottom: 8, left }}
          node={nodeFor(currency, names)}
          link={linkFor(hovered)}
          onMouseEnter={(item, type) => {
            if (type === 'link') {
              setHovered((item as { index?: number }).index ?? null);
            }
          }}
          onMouseLeave={() => setHovered(null)}
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
  const frame = useRef<HTMLDivElement>(null);
  const width = useElementWidth(frame);

  if (shown.links.length === 0) {
    return null;
  }

  const table = (
    <CostFlowTable rows={flowLinkRows(shown)} currency={currency} />
  );
  const narrow = width > 0 && width < NARROW;

  return (
    <div ref={frame}>
      {narrow ? (
        <InsightsCard
          flat
          tableOnly
          title="Where the spend goes"
          description={COST_SANKEY_NOTE}
        >
          {table}
        </InsightsCard>
      ) : (
        <InsightsCard
          flat
          title="Where the spend goes"
          description={COST_SANKEY_NOTE}
          table={table}
          tableHeight="max-h-[296px]"
          chartIcon={Waypoints}
        >
          <SankeyChart shown={shown} currency={currency} width={width} />
        </InsightsCard>
      )}
    </div>
  );
}
