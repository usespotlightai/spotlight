import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { AvatarStack } from '@/components/shared/avatar/AvatarStack';
import type { Attachment } from '@/lib/attachment';
import { namesOf } from '@/lib/people-list';
import type { Person } from '@/lib/person';
import { cn } from '@/lib/utils';

type PersonMessageProps = {
  body: string;
  attachments: readonly Attachment[];
  authors: readonly Person[];
};

export function PersonMessage({
  body,
  attachments,
  authors,
}: PersonMessageProps) {
  const signed = authors.length > 0;

  return (
    <div className="relative flex flex-col items-start gap-1.5">
      <AttachmentTiles attachments={attachments} />

      {body && (
        <div className="self-stretch">
          <MessageCard className={cn(signed && 'pr-10')}>
            <p className="whitespace-pre-wrap text-foreground text-sm leading-6">
              {body}
            </p>
          </MessageCard>
        </div>
      )}

      <AvatarStack
        people={authors}
        label={`${namesOf(authors)} wrote this`}
        className="absolute -top-2 -right-2"
      />
    </div>
  );
}
