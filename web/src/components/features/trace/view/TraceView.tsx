import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SpanDetail } from '@/components/features/trace/view/SpanDetail';
import { TraceGrid } from '@/components/features/trace/view/TraceGrid';
import { TraceRow } from '@/components/features/trace/view/TraceRow';
import { TraceScale } from '@/components/features/trace/view/TraceScale';
import { PaneScroller } from '@/components/shared/PaneScroller';
import { PaneHandle } from '@/components/shell/layout/PaneHandle';
import { useLingering } from '@/hooks/useLingering';
import { usePaneWidth } from '@/hooks/usePaneWidth';
import { took } from '@/lib/inbox';
import { NAMES_PANE, rowsOf, type Trace } from '@/lib/trace';
import { cn } from '@/lib/utils';

const LEAVING = 150;

type TraceViewProps = {
  trace: Trace;
  teamId: string;
};

export function TraceView({ trace, teamId }: TraceViewProps) {
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

  const lingering = useLingering(chosen, LEAVING);

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

  const pick = useCallback((id: string) => setPicked(id), []);

  return (
    <PaneScroller
      aside={
        lingering && (
          <SpanDetail
            node={lingering}
            teamId={teamId}
            open={chosen !== null}
            duration={LEAVING}
            ref={panel}
          />
        )
      }
    >
      <div
        ref={names.paneRef}
        className="relative flex min-w-0 flex-1 flex-col"
        style={{ '--names': `${names.width}px` } as CSSProperties}
      >
        <div
          className={cn(
            'flex flex-1 flex-col',
            names.resizing && 'select-none',
          )}
        >
          <TraceScale label={(tick) => took(Math.round(whole * tick))} />

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
            {...names.handleProps}
            edge="right"
            resizing={names.resizing}
            className="pointer-events-auto"
          />
        </div>
      </div>
    </PaneScroller>
  );
}
