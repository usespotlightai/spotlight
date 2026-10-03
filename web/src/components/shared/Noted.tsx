import { type ReactElement, useId } from 'react';
import { createPortal } from 'react-dom';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type NotedProps = {
  note: string;
  children: ReactElement<Record<string, unknown>>;
};

export function Noted({ note, children }: NotedProps) {
  const noteId = useId();

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={children}
          tabIndex={0}
          aria-describedby={noteId}
          className="cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
        />
        <TooltipContent>{note}</TooltipContent>
      </Tooltip>
      {createPortal(
        <span id={noteId} hidden>
          {note}
        </span>,
        document.body,
      )}
    </>
  );
}
