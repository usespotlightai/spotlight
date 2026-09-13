import type { Ref } from 'react';
import { DetailFields } from '@/components/features/trace/view/detail/DetailFields';
import { DetailHeader } from '@/components/features/trace/view/detail/DetailHeader';
import { DetailSection } from '@/components/features/trace/view/detail/DetailSection';
import { DetailTold } from '@/components/features/trace/view/detail/DetailTold';
import { CodeDiff } from '@/components/shared/CodeDiff';
import { type PaneConfig, SidePane } from '@/components/shared/SidePane';
import {
  answeredBy,
  askedOf,
  type Field,
  holdings,
  restOf,
} from '@/lib/detail';
import type { TraceNode } from '@/lib/trace';

const DETAIL_PANE: PaneConfig = {
  storageKey: 'spotlight.trace-detail-width',
  min: 288,
  max: 960,
  initial: 520,
  label: 'Resize the details',
};

export function SpanDetail({
  node,
  open,
  ref,
}: {
  node: TraceNode;
  open: boolean;
  ref?: Ref<HTMLElement>;
}) {
  const { step } = node;

  const asked = askedOf(node);
  const answered = answeredBy(node);
  const held = holdings(node);
  const rest = restOf(node);

  const holding: Field[] = [...held.kinds].map(([path, count]) => ({
    path,
    value: String(count),
    kind: 'number',
  }));

  const reported: Field[] = rest.map((each) => ({
    path: each.name,
    value: `"${each.value}"`,
    kind: 'string',
  }));

  return (
    <SidePane pane={DETAIL_PANE} open={open} ref={ref}>
      <div className="flex h-full flex-col gap-5 overflow-y-auto px-4 py-4 scrollbar-hide">
        <DetailHeader node={node} />

        {asked && <DetailTold told={asked} />}
        {answered && <DetailTold told={answered} />}

        {step?.change && (
          <DetailSection title="Diff" copy={step.change.after}>
            <p className="flex gap-2 font-mono text-muted-foreground text-xs">
              {step.change.path && (
                <span className="truncate">{step.change.path}</span>
              )}
              {step.locations.length > 0 && (
                <span className="shrink-0">
                  {step.locations
                    .flatMap((where) =>
                      where.line === null ? [] : [where.line],
                    )
                    .join(', ')}
                </span>
              )}
            </p>
            <CodeDiff
              path={step.change.path}
              before={step.change.before}
              after={step.change.after}
            />
          </DetailSection>
        )}

        {holding.length > 0 && (
          <DetailSection title="Contents">
            <DetailFields fields={holding} />
          </DetailSection>
        )}

        {reported.length > 0 && (
          <DetailSection title="Attributes">
            <DetailFields fields={reported} />
          </DetailSection>
        )}
      </div>
    </SidePane>
  );
}
