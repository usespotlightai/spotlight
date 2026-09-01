import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SpanDetail } from '@/components/trace/SpanDetail';
import { TraceHeader } from '@/components/trace/TraceHeader';
import { TraceRow } from '@/components/trace/TraceRow';
import type { RunJournalResponseDto, TaskRunResponseDto } from '@/lib/api';
import { took } from '@/lib/inbox';
import { only, rowsOf, traceOf } from '@/lib/trace';

/** Enough marks to read a length off, few enough to stay out of the way. */
const TICKS = [0, 0.25, 0.5, 0.75, 1];

type TraceViewProps = {
  runs: readonly TaskRunResponseDto[];
  journals: readonly RunJournalResponseDto[];
};

/**
 * Every run that worked one task, laid against one clock. A list says what an
 * agent did; only this says where the time went, which is the thing worth
 * changing the factory over.
 */
export function TraceView({ runs, journals }: TraceViewProps) {
  const trace = useMemo(() => traceOf(runs, journals), [runs, journals]);
  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [picked, setPicked] = useState<string | null>(null);

  const rows = useMemo(
    () => rowsOf(only(trace.roots, query), closed),
    [trace, query, closed],
  );

  const chosen = rows.find((row) => row.node.id === picked)?.node ?? null;
  const whole = Math.max(trace.to - trace.from, 0);

  const toggle = (id: string) =>
    setClosed((held) => {
      const next = new Set(held);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });

  if (runs.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">
          Nothing has worked this task yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TraceHeader trace={trace} journals={journals} />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-border border-b px-4 py-2">
            <Search
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this trace"
              aria-label="Search this trace"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {/* The scale every bar is drawn against, said once at the top. */}
            <div className="sticky top-0 z-10 flex h-6 items-end bg-background">
              <span className="shrink-0" style={{ width: 320 }} />
              <div className="relative min-w-0 flex-1 pr-3">
                {TICKS.map((tick) => (
                  <span
                    key={tick}
                    className="absolute bottom-0 text-faint text-[10px] tabular-nums"
                    style={{
                      left: `${tick * 100}%`,
                      transform: tick === 1 ? 'translateX(-100%)' : undefined,
                    }}
                  >
                    {took(Math.round(whole * tick))}
                  </span>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground text-sm">
                Nothing in this trace says that.
              </p>
            ) : (
              <ul className="flex flex-col pt-2 pb-6">
                {rows.map((row) => (
                  <TraceRow
                    key={row.node.id}
                    row={row}
                    trace={trace}
                    picked={row.node.id === picked}
                    open={!closed.has(row.node.id)}
                    onPick={() => setPicked(row.node.id)}
                    onToggle={() => toggle(row.node.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {chosen && <SpanDetail node={chosen} />}
      </div>
    </div>
  );
}
