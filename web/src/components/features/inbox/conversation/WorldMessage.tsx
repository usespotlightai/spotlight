import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { PinnedText } from '@/components/features/inbox/conversation/PinnedText';
import {
  IntegrationLogo,
  integrationTitle,
} from '@/components/features/integrations/IntegrationLogo';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Attachment } from '@/lib/attachment';
import { namesOf } from '@/lib/people-list';
import type { Person } from '@/lib/person';
import { cn } from '@/lib/utils';

type WorldMessageProps = {
  body: string;
  attachments: readonly Attachment[];
  authors: readonly Person[];
  source: string | null;
  deferredTo: string | null;
};

export function WorldMessage({
  body,
  attachments,
  authors,
  source,
  deferredTo,
}: WorldMessageProps) {
  const from = source ? integrationTitle(source) : null;
  const signed = from !== null || authors.length > 0;

  return (
    <div className="relative flex flex-col items-start gap-1.5">
      <AttachmentTiles attachments={attachments} />

      <div className="self-stretch">
        <MessageCard className={cn(signed && 'pr-10')}>
          <PinnedText>
            <MarkdownEditor
              readOnly
              keepLineBreaks
              initialValue={body}
              placeholder=""
              ariaLabel={from ? `What came from ${from}` : 'What came in'}
              className="border-none bg-transparent p-0"
            />
          </PinnedText>
        </MessageCard>
      </div>

      <SourceAvatars
        source={source}
        from={from}
        authors={authors}
        className="absolute -top-2 -right-2"
      />

      {deferredTo && (
        <p className="px-3 text-muted-foreground text-xs">
          Arrived during a run. If the run does not pass the task on, the task
          moves to {deferredTo} when the run ends.
        </p>
      )}
    </div>
  );
}

function SourceAvatars({
  source,
  from,
  authors,
  className,
}: {
  source: string | null;
  from: string | null;
  authors: readonly Person[];
  className?: string;
}) {
  if (!source && authors.length === 0) {
    return null;
  }

  const label =
    authors.length === 0
      ? `From ${from}`
      : from
        ? `${namesOf(authors)} wrote this in ${from}`
        : `${namesOf(authors)} wrote this`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="img"
            aria-label={label}
            className={cn('flex -space-x-1.5 outline-none', className)}
          />
        }
      >
        {source && (
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card">
            <IntegrationLogo integration={source} className="size-3.5" />
          </span>
        )}

        {authors.map((person) => (
          <PersonAvatar
            key={person.id}
            person={person}
            className="after:hidden"
          />
        ))}
      </TooltipTrigger>
      <TooltipContent className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}
