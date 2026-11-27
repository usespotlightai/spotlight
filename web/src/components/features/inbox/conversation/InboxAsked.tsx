import { StationIcon } from '@/components/features/board/column/StationIcon';
import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { ExpandableText } from '@/components/shared/ExpandableText';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import type { Attachment } from '@/lib/attachment';
import type { ConversationItem } from '@/lib/inbox';
import { nonEmpty } from '@/lib/non-empty';
import { stationShare } from '@/lib/station';

type InboxAskedProps = {
  station: ConversationItem['station'] | null;
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

          {nonEmpty(description) && (
            <ExpandableText what="description">
              <MarkdownEditor
                readOnly
                initialValue={description}
                placeholder=""
                ariaLabel="Description"
                className="border-none bg-transparent p-0"
              />
            </ExpandableText>
          )}
        </div>
      </MessageCard>

      <AttachmentTiles attachments={attachments} />
    </div>
  );
}
