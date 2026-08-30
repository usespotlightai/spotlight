import { StationIcon } from '@/components/board/StationIcon';
import { SaidCard } from '@/components/inbox/SaidCard';
import type { InboxItem } from '@/lib/inbox';
import { stationShare } from '@/lib/station';

/**
 * What the person asked for: the task itself, where it was raised. It opens
 * the conversation because it is the first thing anyone said.
 */
export function InboxAsked({ item }: { item: InboxItem }) {
  const raised = item.raisedAt;

  return (
    <SaidCard>
      <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <StationIcon
          share={stationShare(raised.stationPosition, item.stationCount)}
          color={raised.stationColor}
        />
        {raised.station}
      </span>

      <div>
        <h1 className="font-medium text-foreground text-sm leading-6">
          {item.title}
        </h1>

        {item.description && (
          <p className="whitespace-pre-wrap text-muted-foreground text-sm leading-6">
            {item.description}
          </p>
        )}
      </div>
    </SaidCard>
  );
}
