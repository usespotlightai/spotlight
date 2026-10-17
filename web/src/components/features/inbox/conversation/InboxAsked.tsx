import { StationIcon } from '@/components/features/board/column/StationIcon';
import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import type { Attachment } from '@/lib/attachment';
import type { Conversing } from '@/lib/inbox';
import { stationShare } from '@/lib/station';

type InboxAskedProps = {
  station: Conversing['station'] | null;
  title: string | null;
  description: string | null;
  attachments: readonly Attachment[];
};

export function InboxAsked({
  station,
  title,
  description,
  attachments,
}: InboxAskedProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <MessageCard>
        {station && (
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <StationIcon
              share={stationShare(station.position, station.count)}
              color={station.color}
            />
            {station.name}
          </span>
        )}

        <div>
          <h1 className="font-medium text-foreground text-sm leading-6">
            {title}
          </h1>

          {description && (
            <p className="whitespace-pre-wrap text-muted-foreground text-sm leading-6">
              {description}
            </p>
          )}
        </div>
      </MessageCard>

      <AttachmentTiles attachments={attachments} />
    </div>
  );
}
