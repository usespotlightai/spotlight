import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { SpanDetail } from '@/components/features/trace/view/SpanDetail';
import { TIMELINE } from '@/components/features/trace/view/TraceBar';
import { TraceGrid } from '@/components/features/trace/view/TraceGrid';
import { TraceRow } from '@/components/features/trace/view/TraceRow';
import { TraceScale } from '@/components/features/trace/view/TraceScale';
import { PaneScroller } from '@/components/shared/PaneScroller';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { useDelayedValue } from '@/hooks/useDelayedValue';
import { useDocumentListener } from '@/hooks/useDocumentListener';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import type { LineRange } from '@/lib/changes';
import {
  type CitationTargets,
  CitationTargetsContext,
  NO_CITATION_TARGETS,
} from '@/lib/citation-targets';
import { formatShortDuration } from '@/lib/inbox';
import { lineRangeOf } from '@/lib/judge';
import { nonEmpty } from '@/lib/non-empty';
import {
  ancestorsOf,
  lastChangeTo,
  NAMES_PANE,
  rowsOf,
  stepNodeAt,
  type Trace,
  type TraceNode,
} from '@/lib/trace';
import { cn } from '@/lib/utils';

const LEAVING = 150;

type TraceViewProps = {
  trace: Trace;
  teamId: string;
};

export function TraceView({ trace, teamId }: TraceViewProps): ReactElement {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [picked, setPicked] = useState<string | null>(null);
  const [cited, setCited] = useState<LineRange | null>(null);
  const {
    width: namesWidth,
    resizing: namesResizing,
    paneRef: namesRef,
    handleProps: namesHandle,
  } = usePaneWidth<HTMLDivElement>(NAMES_PANE);
  const listed = useRef<HTMLUListElement>(null);
  const panel = useRef<HTMLElement>(null);

  useDocumentListener(
    'pointerdown',
    (event) => {
      const on = event.target instanceof Node ? event.target : null;

      if (
        listed.current?.contains(on) !== true &&
        panel.current?.contains(on) !== true
      ) {
        setPicked(null);
      }
    },
    picked !== null,
  );
  useDocumentListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        setPicked(null);
      }
    },
    picked !== null,
  );

  const rows = useMemo(() => rowsOf(trace.roots, closed), [trace, closed]);

  const chosen = rows.find((row) => row.node.id === picked)?.node ?? null;

  const displayed = useDelayedValue(chosen, LEAVING);

  const whole = Math.max(trace.ms, 0);

  const toggle = useCallback((id: string) => {
    setClosed((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const pick = useCallback((id: string) => {
    setPicked(id);
    setCited(null);
  }, []);

  const reveal = useCallback(
    (node: TraceNode, lines: LineRange | null) => {
      const above = ancestorsOf(trace.roots, node.id) ?? [];

      setClosed((previous) => {
        const next = new Set(previous);
        for (const id of above) {
          next.delete(id);
        }
        return next;
      });
      setPicked(node.id);
      setCited(lines);

      requestAnimationFrame(() =>
        [...(listed.current?.children ?? [])]
          .find(
            (row) =>
              row instanceof HTMLElement && row.dataset.nodeId === node.id,
          )
          ?.scrollIntoView({ block: 'nearest' }),
      );
    },
    [trace],
  );

  const targets = useMemo<CitationTargets>(() => {
    if (displayed?.kind !== 'run') {
      return NO_CITATION_TARGETS;
    }

    return {
      step: (index) => {
        const node = stepNodeAt(displayed, index);
        return node ? () => reveal(node, null) : null;
      },
      hunk: (hunk) => {
        const node = nonEmpty(hunk.path)
          ? lastChangeTo(displayed, hunk.path)
          : null;
        return node ? () => reveal(node, lineRangeOf(hunk)) : null;
      },
    };
  }, [displayed, reveal]);

  const namesWanted: CSSProperties & Record<`--${string}`, string> = {
    '--names-wanted': `${namesWidth}px`,
  };

  return (
    <PaneScroller
      sidePanel={
        displayed && (
          <CitationTargetsContext value={targets}>
            <SpanDetail
              node={displayed}
              teamId={teamId}
              open={chosen !== null}
              lines={cited}
              duration={LEAVING}
              ref={panel}
              onClose={() => setPicked(null)}
            />
          </CitationTargetsContext>
        )
      }
    >
      <div className="@container/trace flex min-w-0 flex-1 flex-col">
        <div
          ref={namesRef}
          className={cn('relative flex min-w-0 flex-1 flex-col', TIMELINE)}
          style={namesWanted}
        >
          <div
            className={cn(
              'flex flex-1 flex-col',
              namesResizing && 'select-none',
            )}
          >
            <TraceScale
              label={(tick) => formatShortDuration(Math.round(whole * tick))}
            />

            {rows.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground text-sm">
                No matches.
              </p>
            ) : (
              <div className="relative flex-1 px-1.5">
                <TraceGrid />

                <ul ref={listed} className="relative flex flex-col pt-2 pb-6">
                  {rows.map((row) => (
                    <TraceRow
                      key={row.node.id}
                      node={row.node}
                      teamId={teamId}
                      depth={row.depth}
                      childCount={row.children}
                      trace={trace}
                      picked={row.node.id === picked}
                      open={!closed.has(row.node.id)}
                      onPick={pick}
                      onToggle={toggle}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div
            className="pointer-events-none absolute inset-y-0 left-0"
            style={{ width: 'var(--names)' }}
          >
            <PaneHandle
              {...namesHandle}
              edge="right"
              resizing={namesResizing}
              className="pointer-events-auto hidden @md/trace:block"
            />
          </div>
        </div>
      </div>
    </PaneScroller>
  );
}
