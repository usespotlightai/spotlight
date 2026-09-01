import { ContextDonut } from '@/components/inbox/ContextDonut';
import type { RunJournalResponseDto } from '@/lib/api';
import { counted, took } from '@/lib/inbox';
import type { Trace } from '@/lib/trace';

const Stat = ({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-muted-foreground text-xs">{name}</span>
    <span className="flex items-center gap-1 font-medium text-foreground text-sm tabular-nums">
      {children}
    </span>
  </div>
);

export function TraceHeader({
  trace,
  journals,
}: {
  trace: Trace;
  journals: readonly RunJournalResponseDto[];
}) {
  // The last run to say what it was holding: context is not summed across runs,
  // because each one starts again with its own window.
  const spent = journals
    .map((each) => each.spent)
    .filter(Boolean)
    .at(-1);

  const cost = journals.reduce((all, each) => all + (each.spent?.cost ?? 0), 0);

  return (
    <div className="flex shrink-0 flex-wrap items-start gap-x-8 gap-y-3 border-border border-b px-4 py-3">
      <Stat name="Runs">{trace.roots.length}</Stat>
      <Stat name="Rows">{trace.rows}</Stat>
      <Stat name="Took">{took(Math.max(trace.to - trace.from, 0))}</Stat>
      <Stat name="Faults">
        <span className={trace.errors > 0 ? 'text-destructive' : undefined}>
          {trace.errors}
        </span>
      </Stat>

      {spent && (
        <Stat name="Context">
          <ContextDonut used={spent.used} size={spent.size} />
          {counted(spent.used)}/{counted(spent.size)}
        </Stat>
      )}

      {cost > 0 && <Stat name="Cost">${cost.toFixed(4)}</Stat>}
    </div>
  );
}
