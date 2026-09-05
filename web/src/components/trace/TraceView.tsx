import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PaneHandle } from '@/components/layout/PaneHandle';
import { SpanDetail } from '@/components/trace/SpanDetail';
import { LABEL_ROOM } from '@/components/trace/TraceBar';
import { TraceRow } from '@/components/trace/TraceRow';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { took } from '@/lib/inbox';
import { rowsOf, type Trace, type TraceNode } from '@/lib/trace';
import { cn } from '@/lib/utils';

// Matches the pane's close animation so it stays mounted until that finishes.
const LEAVING = 240;

const NAMES_PANE = {
  property: '--names',
  storageKey: 'spotlight.trace-names-width',
  min: 200,
  max: 640,
  initial: 320,
  label: 'Resize the names',
};

const TICKS = [0, 0.25, 0.5, 0.75, 1];

type TraceViewProps = {
  trace: Trace;
};

export function TraceView({ trace }: TraceViewProps) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [picked, setPicked] = useState<string | null>(null);
  const names = usePaneWidth<HTMLDivElement>(NAMES_PANE);
  const listed = useRef<HTMLUListElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (picked === null) {
      return;
    }

    const away = (event: PointerEvent) => {
      const on = event.target as Node;

      if (!listed.current?.contains(on) && !panel.current?.contains(on)) {
        setPicked(null);
      }
    };

    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [picked]);

  const rows = useMemo(() => rowsOf(trace.roots, closed), [trace, closed]);

  const chosen = rows.find((row) => row.node.id === picked)?.node ?? null;

  const [held, setHeld] = useState<TraceNode | null>(null);

  useEffect(() => {
    if (chosen) {
      setHeld(chosen);
      return;
    }

    if (held === null) {
      return;
    }

    const timer = setTimeout(() => setHeld(null), LEAVING);
    return () => clearTimeout(timer);
  }, [chosen, held]);

  const whole = Math.max(trace.ms, 0);

  const toggle = useCallback((id: string) => {
    setClosed((held) => {
      const next = new Set(held);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const pick = useCallback((id: string) => setPicked(id), []);

  if (trace.roots.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">No runs yet.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={names.paneRef}
            // Nothing here sets a floor on how narrow it may go, so the panel
            // beside it can take the width it is dragged to.
            className="relative min-h-0 min-w-0 flex-1"
            style={{ '--names': `${names.width}px` } as CSSProperties}
          >
            <div
              className={cn(
                'flex h-full flex-col overflow-auto scrollbar-hide',
                names.resizing && 'select-none',
              )}
            >
              <div className="sticky top-0 z-20 flex h-6 min-w-0 shrink-0 items-end border-border border-b-[0.5px] bg-surface px-1.5">
                <span className="shrink-0" style={{ width: 'var(--names)' }} />
                <div
                  className="relative min-w-0 flex-1"
                  style={{ marginRight: LABEL_ROOM }}
                >
                  {TICKS.map((tick) => (
                    <span
                      key={tick}
                      className="absolute bottom-0 whitespace-nowrap text-faint text-[10px] tabular-nums"
                      style={{
                        left: `${tick * 100}%`,
                        transform:
                          tick === 1
                            ? 'translateX(-100%)'
                            : tick === 0
                              ? undefined
                              : 'translateX(-50%)',
                      }}
                    >
                      {took(Math.round(whole * tick))}
                    </span>
                  ))}
                </div>
              </div>

              {rows.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground text-sm">
                  No matches.
                </p>
              ) : (
                <div className="relative flex-1 px-1.5">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0"
                    style={{ left: 'var(--names)', right: LABEL_ROOM }}
                  >
                    {TICKS.map((tick) => (
                      <span
                        key={tick}
                        className="absolute inset-y-0 w-[0.5px] bg-border"
                        // The last one hangs off the right edge if it is placed
                        // from the left, so it is placed from the right.
                        style={
                          tick === 1 ? { right: 0 } : { left: `${tick * 100}%` }
                        }
                      />
                    ))}
                  </div>

                  <ul ref={listed} className="relative flex flex-col pt-2 pb-6">
                    {rows.map((row) => (
                      <TraceRow
                        key={row.node.id}
                        node={row.node}
                        depth={row.depth}
                        holding={row.children}
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

            {/* The names have no element of their own — every row draws its
                own — so the grip is given one to hang from, outside the
                scroll so it fades against the height that is actually seen. */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0"
              style={{ width: 'var(--names)' }}
            >
              <PaneHandle
                {...names.handleProps}
                edge="right"
                resizing={names.resizing}
                className="pointer-events-auto"
              />
            </div>
          </div>
        </div>

        {held && <SpanDetail node={held} open={chosen !== null} ref={panel} />}
      </div>
    </div>
  );
}
