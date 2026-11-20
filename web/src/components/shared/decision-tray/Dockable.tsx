import { ChevronRight } from 'lucide-react';
import { type ReactNode, use } from 'react';

import { DecisionTrayContext, dockedIn } from '@/lib/decision-tray';

type DockableProps = {
  id: string;
  run?: number;
  children: ReactNode;
};

export function Dockable({ id, run = 1, children }: DockableProps) {
  const tray = use(DecisionTrayContext);
  const docked = dockedIn(tray, id);

  if (!tray || !docked) {
    return children;
  }

  const label = run > 1 ? docked.group : docked.label;

  return (
    <div data-decision className="flex">
      <button
        type="button"
        data-slot="docked-link"
        aria-label={`Show ${label}`}
        className="flex max-w-full items-center gap-1 self-start rounded text-left text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => tray.show(id)}
      >
        <span className="truncate">{label}</span>
        <ChevronRight aria-hidden className="size-3.5 shrink-0" />
      </button>
    </div>
  );
}
