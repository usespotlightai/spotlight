import type { CSSProperties, Ref } from 'react';
import { DetailDiff } from '@/components/features/trace/view/detail/DetailDiff';
import { DetailFields } from '@/components/features/trace/view/detail/DetailFields';
import { DetailHeader } from '@/components/features/trace/view/detail/DetailHeader';
import { DetailSection } from '@/components/features/trace/view/detail/DetailSection';
import { DetailTold } from '@/components/features/trace/view/detail/DetailTold';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
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
  property: '--detail-w',
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

  const openState = {
    'data-closed': open ? undefined : '',
    'data-open': open ? '' : undefined,
  };

  return (
    <div
      ref={(node) => {
        paneRef.current = node;

        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      style={{ '--detail-w': `${width}px` } as CSSProperties}
      {...openState}
      className={cn(
        'relative w-[var(--detail-w)] shrink-0',
        'data-open:[animation:detail-room-open_240ms_ease-in-out]',
        'data-closed:[animation:detail-room-close_240ms_ease-in-out_forwards]',
      )}
    >
      <aside
        {...openState}
        style={{ width: 'calc(var(--detail-w) - 16px)' }}
        className={cn(
          'absolute inset-y-2 right-2 flex flex-col overflow-hidden rounded-lg border-[0.5px] border-border bg-card shadow-pane',
          'data-open:[animation:detail-open_240ms_ease-in-out]',
          'data-closed:[animation:detail-close_240ms_ease-in-out_forwards]',
          resizing && 'select-none',
        )}
      >
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
                {/* The lines it touched: the only thing locations say that
                      the input and the row's own name do not. */}
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

      <PaneHandle
        {...handleProps}
        edge="left"
        resizing={resizing}
        className="inset-y-2 left-1"
      />
    </div>
  );
}
