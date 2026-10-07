import { X } from 'lucide-react';
import { BeforeAfter } from '@/components/features/insights/changes/BeforeAfter';
import { type PaneConfig, SidePane } from '@/components/shared/SidePane';
import {
  type InsightsPeriod,
  type StationNames,
  stationShown,
} from '@/lib/insights';
import type { ChangeAt } from '@/lib/insights-changes';

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
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex items-center gap-2 px-4 py-2">
          <p className="min-w-0 flex-1 truncate font-medium text-foreground text-xs">
            {stationShown(names, change.stationId)}: impact
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the change"
            className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <BeforeAfter
            slug={slug}
            teamId={teamId}
            period={period}
            change={change}
            names={names}
          />
        </div>
      </aside>
    </SidePane>
  );
}
