import { StationIcon } from '@/components/features/board/column/StationIcon';
import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import type { InboxItem } from '@/lib/inbox';
import { stationShare } from '@/lib/station';

export function InboxAsked({ item }: { item: InboxItem }) {
  const raised = item.raisedAt;

  return (
    <SaidCard>
      <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <StationIcon
          share={stationShare(raised.position, item.stationCount)}
          color={raised.color}
        />
        {raised.name}
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
