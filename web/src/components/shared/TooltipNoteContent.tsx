import type { TooltipNote } from '@/lib/tooltip-note';

export function TooltipNoteContent({ note }: { note: TooltipNote }) {
  return (
    <span className="flex flex-col gap-1 py-1">
      {note.title && <span className="font-medium">{note.title}</span>}
      {note.body && <span>{note.body}</span>}
      {note.rows && note.rows.length > 0 && (
        <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
          {note.rows.map(([label, value]) => (
            <span key={label} className="contents">
              <span className="whitespace-nowrap text-popover-foreground/70">
                {label}
              </span>
              <span className="min-w-0 wrap-anywhere tabular-nums">
                {value}
              </span>
            </span>
          ))}
        </span>
      )}
      {note.list && note.list.items.length > 0 && (
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{note.list.title}</span>
          {note.list.items.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </span>
      )}
    </span>
  );
}
