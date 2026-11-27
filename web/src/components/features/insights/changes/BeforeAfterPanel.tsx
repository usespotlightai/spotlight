import { X } from 'lucide-react';

import { BeforeAfter } from '@/components/features/insights/changes/BeforeAfter';
import { type PaneConfig, SidePane } from '@/components/shared/SidePane';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PANEL_SLOT } from '@/lib/before-after-panel';
import {
  formatStation,
  type InsightsPeriod,
  type StationNames,
} from '@/lib/insights';
import type { ChangeAt } from '@/lib/insights-changes';
import { formatDay } from '@/lib/judge';
import { nonEmpty } from '@/lib/non-empty';

const BEFORE_AFTER_PANE: PaneConfig = {
  storageKey: 'spotlight.before-after-width',
  min: 320,
  max: 720,
  initial: 420,
  label: 'Resize the change',
};

type BeforeAfterPanelProps = {
  slug: string;
  teamId: string;
  period: InsightsPeriod;
  change: ChangeAt;
  names: StationNames;
  open: boolean;
  onClose: () => void;
};

export function BeforeAfterPanel({
  slug,
  teamId,
  period,
  change,
  names,
  open,
  onClose,
}: BeforeAfterPanelProps) {
  return (
    <SidePane pane={BEFORE_AFTER_PANE} open={open}>
      <aside
        aria-label="Impact of the change"
        data-slot={PANEL_SLOT}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex items-start gap-2 px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground text-sm">
              Impact at {formatStation(names, change.stationId)}
            </p>
            <p className="truncate text-muted-foreground text-xs">
              {[
                names.get(change.stationId)?.lineName,
                nonEmpty(change.firstRunAt) &&
                  `first run ${formatDay(change.firstRunAt.slice(0, 10))}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the change"
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>

        <ScrollArea
          className="min-h-0 flex-1"
          contentClassName="min-h-full px-4 py-4"
        >
          <BeforeAfter
            slug={slug}
            teamId={teamId}
            period={period}
            change={change}
            names={names}
          />
        </ScrollArea>
      </aside>
    </SidePane>
  );
}
