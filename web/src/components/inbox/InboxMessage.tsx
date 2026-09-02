import { StationIcon } from '@/components/board/StationIcon';
import { MarkdownEditor } from '@/components/common/form/MarkdownEditor';
import { InboxWork } from '@/components/inbox/InboxWork';
import { PersonSaid } from '@/components/inbox/PersonSaid';
import { SaidCard } from '@/components/inbox/SaidCard';
import { useSession } from '@/hooks/api/useSession';
import {
  HELD_AT_TOP,
  type InboxMessage as Message,
  type RunJournal,
} from '@/lib/inbox';
import { stationShare } from '@/lib/station';

type InboxMessageProps = {
  message: Message;
  // How many stations the line holds, which a place is a share of.
  stationCount: number;
  worked: readonly RunJournal[];
};

export function InboxMessage({
  message,
  stationCount,
  worked,
}: InboxMessageProps) {
  const { data: session } = useSession();

  if (message.voice === 'world') {
    return (
      // The same inset the held cards carry, so every card is one width and
      // the words inside them all line up with the plain text.
      <li data-note={message.position} className="-mx-3">
        <SaidCard>
          <p className="whitespace-pre-wrap text-foreground text-sm leading-6">
            {message.body}
          </p>
        </SaidCard>
      </li>
    );
  }

  if (message.voice === 'person') {
    return (
      <li data-note={message.position} className={HELD_AT_TOP}>
        <PersonSaid
          body={message.body}
          // Your own words need no name on them.
          name={
            message.author && message.author.id !== session?.user.id
              ? message.author.name
              : null
          }
        />
      </li>
    );
  }

  return (
    <li data-note={message.position} className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <StationIcon
          share={stationShare(message.stationPosition, stationCount)}
          color={message.stationColor}
        />
        {message.station}
      </span>

      {worked.length > 0 && <InboxWork journals={worked} />}

      <MarkdownEditor
        readOnly
        initialValue={message.body}
        placeholder=""
        ariaLabel={`What ${message.station} said`}
        className="border-none bg-transparent p-0"
      />
    </li>
  );
}
