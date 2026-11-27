import type { ReactElement } from 'react';

import { ExpandableText } from '@/components/features/inbox/conversation/ExpandableText';
import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { IntegrationLogo } from '@/components/features/integrations/IntegrationLogo';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { GithubLogo } from '@/components/shared/icons';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MessageSource } from '@/hooks/api/useMessageSources';
import type { Attachment } from '@/lib/attachment';
import { namesOf } from '@/lib/people-list';
import type { Person } from '@/lib/person';
import { cn } from '@/lib/utils';

type WorldMessageProps = {
  body: string;
  attachments: readonly Attachment[];
  authors: readonly Person[];
  source: MessageSource | null;
  deferredTo: string | null;
};

export function WorldMessage({
  body,
  attachments,
  authors,
  source,
  deferredTo,
}: WorldMessageProps): ReactElement {
  const from = source?.name ?? null;
  const signed = from !== null || authors.length > 0;

  return (
    <div className="relative flex flex-col items-start gap-1.5">
      <AttachmentTiles attachments={attachments} />

      <div className="self-stretch">
        <MessageCard>
          <ExpandableText what="message">
            <MarkdownEditor
              readOnly
              keepLineBreaks
              initialValue={body}
              placeholder=""
              ariaLabel={
                from !== null && from !== ''
                  ? `What came from ${from}`
                  : 'What came in'
              }
              className={cn('border-none bg-transparent p-0', signed && 'pr-7')}
            />
          </ExpandableText>
        </MessageCard>
      </div>

      <SourceAvatars
        source={source}
        from={from}
        authors={authors}
        className="absolute -top-2 -right-2"
      />

      {deferredTo !== null && deferredTo !== '' && (
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
  source: MessageSource | null;
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
      : from !== null && from !== ''
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
            <SourceLogo source={source} />
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

function SourceLogo({ source }: { source: MessageSource }) {
  if (source.integration === 'github' && source.logo === null) {
    return (
      <GithubLogo aria-hidden className="size-3.5 shrink-0 text-foreground" />
    );
  }

  return (
    <IntegrationLogo
      logo={source.logo}
      name={source.name}
      className="size-3.5"
    />
  );
}
