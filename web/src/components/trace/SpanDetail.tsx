import type { Ref } from 'react';
import { PaneHandle } from '@/components/layout/PaneHandle';
import { DetailDiff } from '@/components/trace/detail/DetailDiff';
import { DetailFields } from '@/components/trace/detail/DetailFields';
import { DetailHeader } from '@/components/trace/detail/DetailHeader';
import { DetailSection } from '@/components/trace/detail/DetailSection';
import { DetailTold } from '@/components/trace/detail/DetailTold';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import {
  answeredBy,
  askedOf,
  type Field,
  holdings,
  restOf,
} from '@/lib/detail';
import type { TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

const DETAIL_PANE = {
  storageKey: 'spotlight.trace-detail-width',
  min: 288,
  max: 960,
  initial: 520,
  label: 'Resize the details',
  edge: 'left' as const,
};

/** The same panel whatever was picked: a row answers what it can, in order. */
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
  const { width, resizing, handleProps, paneRef } =
    usePaneWidth<HTMLElement>(DETAIL_PANE);

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
    <aside
      ref={(node) => {
        paneRef.current = node;

        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      style={{ width }}
      data-closed={open ? undefined : ''}
      data-open={open ? '' : undefined}
      className={cn(
        // The duration is for the animations below. Transitions are off, or
        // every width the drag writes would be animated to over 150ms and the
        // panel would trail the pointer.
        'relative shrink-0 border-border border-l-[0.5px] transition-none duration-150',
        'data-open:animate-in data-open:fade-in data-open:slide-in-from-right-4',
        // Held at where it left off until it is taken away: without this the
        // animation ends, the panel snaps back to full, and it flickers.
        'data-closed:animate-out data-closed:fade-out data-closed:slide-out-to-right-4 data-closed:fill-mode-forwards',
        resizing && 'select-none',
      )}
    >
      <PaneHandle {...handleProps} edge="left" resizing={resizing} />

      <div className="flex h-full flex-col gap-5 overflow-y-auto px-4 py-4">
        <DetailHeader node={node} />

        {asked && <DetailTold told={asked} />}
        {answered && <DetailTold told={answered} />}

        {step?.change && (
          <DetailSection title="Diff" copy={step.change.after}>
            <p className="flex gap-2 font-mono text-muted-foreground text-xs">
              {step.change.path && (
                <span className="truncate">{step.change.path}</span>
              )}
              {/* The lines it touched: the only thing locations say that the
                  input and the row's own name do not. */}
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
            <DetailDiff
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
    </aside>
  );
}
